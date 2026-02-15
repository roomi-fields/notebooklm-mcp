/**
 * Citation Extractor for NotebookLM
 *
 * Extracts source citations from NotebookLM responses:
 * - Source names from citation button aria-labels (instant, 100% reliable)
 * - Source excerpts by clicking citations to open the source panel (reads .highlighted)
 * - All done via page.evaluate() — no ElementHandle references that can go stale
 *
 * Multiple output formats: inline, footnotes, json, expanded
 */

import type { Page, ElementHandle } from 'patchright';
import { log } from './logger.js';
import { randomDelay } from './stealth-utils.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Source format options for citation display
 */
export type SourceFormat =
  | 'none' // No source extraction (default, fastest)
  | 'inline' // Insert source text inline: "text [1: source excerpt]"
  | 'footnotes' // Append sources at the end as footnotes
  | 'json' // Return sources as separate JSON object
  | 'expanded'; // Replace [1] with full quoted source text

/**
 * Extracted citation data
 */
export interface Citation {
  /** Citation marker (e.g., "[1]", "[2]") */
  marker: string;
  /** Citation number */
  number: number;
  /** Source text from hover tooltip */
  sourceText: string;
  /** Source name/title if available */
  sourceName?: string;
}

/**
 * Result of citation extraction
 */
export interface CitationExtractionResult {
  /** Original answer text */
  originalAnswer: string;
  /** Formatted answer with sources (based on format) */
  formattedAnswer: string;
  /** Extracted citations */
  citations: Citation[];
  /** Format used */
  format: SourceFormat;
  /** Whether extraction was successful */
  success: boolean;
  /** Error message if extraction failed */
  error?: string;
}

// ============================================================================
// CSS Selectors for NotebookLM Citations
// ============================================================================

// ============================================================================
// Main Extraction Function
// ============================================================================

/**
 * Extract citations from a NotebookLM response by hovering over citation markers
 *
 * @param page Playwright page instance
 * @param answerText The answer text to process
 * @param responseContainer The container element holding the response
 * @param format Desired output format
 * @returns Extraction result with formatted answer and citations
 */
export async function extractCitations(
  page: Page,
  answerText: string,
  _responseContainer: ElementHandle | null,
  format: SourceFormat = 'none'
): Promise<CitationExtractionResult> {
  // Early return if no extraction requested
  if (format === 'none') {
    return {
      originalAnswer: answerText,
      formattedAnswer: answerText,
      citations: [],
      format,
      success: true,
    };
  }

  log.info(`📚 [CITATIONS] Extracting sources (format: ${format})...`);

  const citations: Citation[] = [];

  try {
    // ================================================================
    // SIMPLE APPROACH: Extract all citation data in ONE page.evaluate()
    // No hover, no click, no ElementHandle — just read the DOM directly.
    //
    // NotebookLM citation buttons have:
    //   - innerText: the citation number (e.g. "1")
    //   - child span[aria-label]: "N: Source Name.pdf"
    //
    // For source excerpts, we click each citation to open the source panel.
    // ================================================================
    // IMPORTANT: Scope to the LAST response container only!
    // After multiple questions, the page has citation buttons from ALL previous answers.
    // If we querySelectorAll('button.citation-marker') globally, we click old citations
    // from previous responses → wrong source panel → no highlights for current answer.
    const rawCitations: Array<{ number: number; sourceName: string }> = await page.evaluate(`
      (() => {
        // Find the last response container (most recent answer)
        const containers = document.querySelectorAll('.to-user-container .message-text-content');
        const lastContainer = containers.length > 0 ? containers[containers.length - 1] : document;

        const buttons = lastContainer.querySelectorAll('button.citation-marker');
        const seen = new Set();
        const results = [];

        buttons.forEach((btn) => {
          const text = btn.textContent || '';
          const match = text.match(/(\\d+)/);
          if (!match) return;
          const num = parseInt(match[1], 10);
          if (seen.has(num)) return;
          seen.add(num);

          const span = btn.querySelector('span[aria-label]');
          let sourceName = '';
          if (span) {
            const label = span.getAttribute('aria-label') || '';
            const colonIdx = label.indexOf(': ');
            sourceName = colonIdx > 0 ? label.substring(colonIdx + 2).trim() : label.trim();
          }

          results.push({ number: num, sourceName });
        });

        return results.sort((a, b) => a.number - b.number);
      })()
    `);

    if (rawCitations.length === 0) {
      log.info(`📚 [CITATIONS] No citation markers found in response`);
      return {
        originalAnswer: answerText,
        formattedAnswer: answerText,
        citations: [],
        format,
        success: true,
      };
    }

    log.info(`📚 [CITATIONS] Found ${rawCitations.length} citation markers`);

    // Extract source excerpts by CLICKING each citation button.
    // Click opens the source panel with .highlighted marking the cited passage.
    // Use JS .click() — real mouse clicks and hover don't work reliably in headless.
    for (const { number, sourceName } of rawCitations) {
      const marker = `[${number}]`;
      let sourceText = '';

      try {
        // Step 1: Click the citation button (scoped to LAST response container)
        const clicked = await page.evaluate(`
          (() => {
            const containers = document.querySelectorAll('.to-user-container .message-text-content');
            const scope = containers.length > 0 ? containers[containers.length - 1] : document;
            const num = ${number};
            const buttons = scope.querySelectorAll('button.citation-marker');
            for (const btn of buttons) {
              const text = btn.textContent || '';
              const match = text.match(/(\\d+)/);
              if (match && parseInt(match[1], 10) === num) {
                btn.scrollIntoView({ block: 'center' });
                btn.click();
                return true;
              }
            }
            return false;
          })()
        `);

        if (clicked) {
          // Step 2: Wait for .highlighted to appear (poll with timeout)
          const maxWaitMs = 3000;
          const pollMs = 200;
          const startTime = Date.now();
          while (Date.now() - startTime < maxWaitMs) {
            sourceText = await page.evaluate(`
              (() => {
                const highlights = document.querySelectorAll('.highlighted');
                if (highlights.length === 0) return '';

                const hTexts = Array.from(highlights).map(el => el.innerText?.trim()).filter(Boolean);
                if (hTexts.length === 0) return '';

                const parent = highlights[0].closest('.paragraph') || highlights[0].parentElement;
                const pText = parent?.innerText?.trim() || '';
                const hText = hTexts.join(' ');

                return pText.length > hText.length ? pText : hText;
              })()
            `);
            if (sourceText) break;
            await new Promise((r) => setTimeout(r, pollMs));
          }

          // Step 3: Dismiss the source panel
          await page.keyboard.press('Escape');
          await randomDelay(200, 400);
        }
      } catch (error) {
        log.warning(`  ⚠️  [${marker}] Click/extract failed: ${error}`);
      }

      // Always add the citation (with excerpt or just source name)
      citations.push({
        marker,
        number,
        sourceText: sourceText || sourceName,
        sourceName: sourceName || undefined,
      });

      if (sourceText && sourceText !== sourceName) {
        log.success(`  ✅ [${marker}] ${sourceName}: "${sourceText.substring(0, 80)}..."`);
      } else {
        log.info(`  📄 [${marker}] ${sourceName} (no excerpt)`);
      }
    }

    // Dismiss any leftover source panel to ensure chat input is accessible for next question
    try {
      await page.keyboard.press('Escape');
      await randomDelay(300, 500);
      // Click on the chat area to ensure focus returns there
      await page.evaluate(`
        (() => {
          const input = document.querySelector('textarea.query-box-input');
          if (input) input.focus();
        })()
      `);
    } catch {
      // Best effort
    }

    // Format the answer based on requested format
    const formattedAnswer = formatAnswerWithSources(answerText, citations, format);

    const withExcerpt = citations.filter(
      (c) => c.sourceText && c.sourceText !== c.sourceName
    ).length;
    log.success(
      `📚 [CITATIONS] Extracted ${citations.length}/${rawCitations.length} sources (${withExcerpt} with excerpts)`
    );

    return {
      originalAnswer: answerText,
      formattedAnswer,
      citations,
      format,
      success: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error(`❌ [CITATIONS] Extraction failed: ${errorMessage}`);

    return {
      originalAnswer: answerText,
      formattedAnswer: answerText,
      citations: [],
      format,
      success: false,
      error: errorMessage,
    };
  }
}

// ============================================================================
// Formatting Functions
// ============================================================================

/**
 * Format the answer with extracted sources based on requested format
 */
export function formatAnswerWithSources(
  answer: string,
  citations: Citation[],
  format: SourceFormat
): string {
  if (citations.length === 0 || format === 'none') {
    return answer;
  }

  switch (format) {
    case 'inline':
      return formatInline(answer, citations);
    case 'footnotes':
      return formatFootnotes(answer, citations);
    case 'expanded':
      return formatExpanded(answer, citations);
    case 'json':
      // For JSON format, we return the original answer
      // The citations are available in the result object
      return answer;
    default:
      return answer;
  }
}

/**
 * Format with inline source excerpts: "text [1: source excerpt]"
 *
 * NotebookLM returns citations in different formats:
 * - Superscript numbers without brackets: "text1,2" or "text3"
 * - Sometimes with brackets: "text[1]"
 * - Sometimes stuck together: "text123" (meaning citations 1, 2, 3)
 *
 * This function handles all formats.
 */
function formatInline(answer: string, citations: Citation[]): string {
  let result = answer;

  // Sort citations by number in DESCENDING order to avoid replacing [1] before [10]
  const sortedCitations = [...citations].sort((a, b) => b.number - a.number);

  for (const citation of sortedCitations) {
    const shortSource = truncateSource(citation.sourceText, 100);
    const num = citation.number;
    const inlineReplacement = `[${num}: "${shortSource}"]`;

    // Pattern 1: Bracketed format [n]
    const bracketedPattern = `\\[${num}\\]`;
    if (new RegExp(bracketedPattern).test(result)) {
      result = result.replace(new RegExp(bracketedPattern, 'g'), inlineReplacement);
      continue;
    }

    // Pattern 2: Superscript format - number followed by comma/period/space/newline/end
    // Also handles citations stuck together by using lookahead for next digit or punctuation
    // Match: "word1," or "word1." or "word12" (where we want to match the 1)
    const superscriptPattern = `(\\D)(${num})(?=[,\\.;:\\s\\n]|(?=\\d)|$)`;
    if (new RegExp(superscriptPattern).test(result)) {
      result = result.replace(new RegExp(superscriptPattern, 'g'), `$1${inlineReplacement}`);
    }
  }

  return result;
}

/**
 * Format with footnotes at the end
 */
function formatFootnotes(answer: string, citations: Citation[]): string {
  if (citations.length === 0) return answer;

  const footnotes = citations
    .map((c) => {
      const source = c.sourceName ? `${c.sourceName}: ` : '';
      return `${c.marker} ${source}${c.sourceText}`;
    })
    .join('\n\n');

  return `${answer}\n\n---\n**Sources:**\n${footnotes}`;
}

/**
 * Format with expanded inline quotes replacing markers
 *
 * Handles bracketed [n], superscript n, and stuck-together formats.
 */
function formatExpanded(answer: string, citations: Citation[]): string {
  let result = answer;

  // Sort citations by number in DESCENDING order to avoid replacing 1 before 10
  const sortedCitations = [...citations].sort((a, b) => b.number - a.number);

  for (const citation of sortedCitations) {
    const shortSource = truncateSource(citation.sourceText, 150);
    const replacement = `"${shortSource}"`;
    const num = citation.number;

    // Pattern 1: Bracketed format [n]
    const bracketedPattern = `\\[${num}\\]`;
    if (new RegExp(bracketedPattern).test(result)) {
      result = result.replace(new RegExp(bracketedPattern, 'g'), replacement);
      continue;
    }

    // Pattern 2: Superscript format - also handles stuck-together citations
    const superscriptPattern = `(\\D)(${num})(?=[,\\.;:\\s\\n]|(?=\\d)|$)`;
    if (new RegExp(superscriptPattern).test(result)) {
      result = result.replace(new RegExp(superscriptPattern, 'g'), `$1${replacement}`);
    }
  }

  return result;
}

/**
 * Truncate source text to a reasonable length
 */
function truncateSource(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// ============================================================================
// Exports
// ============================================================================

export default {
  extractCitations,
  formatAnswerWithSources,
};
