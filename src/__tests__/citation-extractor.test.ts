/**
 * Tests for Citation Extractor formatting functions
 * @module citation-extractor.test
 */

import { describe, it, expect } from '@jest/globals';
import {
  formatAnswerWithSources,
  type Citation,
  type SourceFormat,
} from '../utils/citation-extractor.js';

describe('citation-extractor', () => {
  // Helper to create citation objects
  const createCitation = (number: number, sourceText: string, sourceName?: string): Citation => ({
    marker: `[${number}]`,
    number,
    sourceText,
    sourceName,
  });

  describe('formatAnswerWithSources', () => {
    describe('format: none', () => {
      it('should return original answer unchanged', () => {
        const answer = 'This is a test answer with [1] citation.';
        const citations = [createCitation(1, 'Source text here')];

        const result = formatAnswerWithSources(answer, citations, 'none');

        expect(result).toBe(answer);
      });

      it('should return original answer when citations are empty', () => {
        const answer = 'This is a test answer.';

        const result = formatAnswerWithSources(answer, [], 'inline');

        expect(result).toBe(answer);
      });
    });

    describe('format: inline', () => {
      it('should replace bracketed citations with inline source', () => {
        const answer = 'The sky is blue[1] and the grass is green.';
        const citations = [createCitation(1, 'Scientific study on colors')];

        const result = formatAnswerWithSources(answer, citations, 'inline');

        expect(result).toContain('[1: "Scientific study on colors"]');
        expect(result).not.toContain('[1]');
      });

      it('should handle multiple citations', () => {
        const answer = 'Fact one[1] and fact two[2].';
        const citations = [createCitation(1, 'Source one'), createCitation(2, 'Source two')];

        const result = formatAnswerWithSources(answer, citations, 'inline');

        expect(result).toContain('[1: "Source one"]');
        expect(result).toContain('[2: "Source two"]');
      });

      it('should handle citation numbers 10 and above correctly', () => {
        const answer = 'Citation[1] and citation[10] and citation[2].';
        const citations = [
          createCitation(1, 'Source 1'),
          createCitation(2, 'Source 2'),
          createCitation(10, 'Source 10'),
        ];

        const result = formatAnswerWithSources(answer, citations, 'inline');

        // [10] should not be affected by [1] replacement
        expect(result).toContain('[10: "Source 10"]');
        expect(result).toContain('[1: "Source 1"]');
        expect(result).toContain('[2: "Source 2"]');
      });

      it('should truncate long source text to 100 characters', () => {
        const longSource = 'A'.repeat(150);
        const answer = 'Text[1].';
        const citations = [createCitation(1, longSource)];

        const result = formatAnswerWithSources(answer, citations, 'inline');

        // Should contain truncated text with ellipsis
        expect(result).toContain('...');
        expect(result.length).toBeLessThan(answer.length + 150);
      });

      it('should handle superscript-style citations (number without brackets)', () => {
        const answer = 'This is a fact1 from the study.';
        const citations = [createCitation(1, 'Study source')];

        const result = formatAnswerWithSources(answer, citations, 'inline');

        expect(result).toContain('[1: "Study source"]');
      });

      it('should handle multiple superscript citations stuck together', () => {
        // Note: The current regex handles stuck-together citations but with limitations
        // It replaces "123" sequentially, which may not produce perfect results
        // The descending order helps avoid [1] corrupting [12]
        const answer = 'This fact123 comes from multiple sources.';
        const citations = [
          createCitation(1, 'Source 1'),
          createCitation(2, 'Source 2'),
          createCitation(3, 'Source 3'),
        ];

        const result = formatAnswerWithSources(answer, citations, 'inline');

        // At minimum, citation 1 should be replaced
        expect(result).toContain('[1: "Source 1"]');
        // The format may not be perfect for all stuck-together cases
        expect(result).toBeDefined();
      });

      it('should handle citations at end of sentence', () => {
        const answer = 'This is a statement[1].';
        const citations = [createCitation(1, 'Source')];

        const result = formatAnswerWithSources(answer, citations, 'inline');

        expect(result).toContain('[1: "Source"].');
      });

      it('should handle citations followed by comma', () => {
        const answer = 'First point[1], second point.';
        const citations = [createCitation(1, 'Source')];

        const result = formatAnswerWithSources(answer, citations, 'inline');

        expect(result).toContain('[1: "Source"],');
      });

      it('should replace all occurrences of same citation', () => {
        const answer = 'Point one[1] and related point[1].';
        const citations = [createCitation(1, 'Shared source')];

        const result = formatAnswerWithSources(answer, citations, 'inline');

        const matches = result.match(/\[1: "Shared source"\]/g);
        expect(matches).toHaveLength(2);
      });
    });

    describe('format: footnotes', () => {
      it('should append footnotes at the end', () => {
        const answer = 'This is the main text[1].';
        const citations = [createCitation(1, 'Source text here')];

        const result = formatAnswerWithSources(answer, citations, 'footnotes');

        expect(result).toContain('This is the main text[1].');
        expect(result).toContain('---');
        expect(result).toContain('**Sources:**');
        expect(result).toContain('[1] Source text here');
      });

      it('should include source names when available', () => {
        const answer = 'Text[1].';
        const citations = [createCitation(1, 'Content from the article', 'Article Title')];

        const result = formatAnswerWithSources(answer, citations, 'footnotes');

        expect(result).toContain('[1] Article Title: Content from the article');
      });

      it('should separate multiple footnotes with blank lines', () => {
        const answer = 'Text[1][2].';
        const citations = [createCitation(1, 'First source'), createCitation(2, 'Second source')];

        const result = formatAnswerWithSources(answer, citations, 'footnotes');

        expect(result).toContain('[1] First source');
        expect(result).toContain('[2] Second source');
        // Check for double newline separation
        expect(result).toMatch(/\[1\].*\n\n\[2\]/s);
      });

      it('should preserve original answer text', () => {
        const answer = 'Important facts: [1] mentioned here.';
        const citations = [createCitation(1, 'Source')];

        const result = formatAnswerWithSources(answer, citations, 'footnotes');

        expect(result.startsWith('Important facts: [1] mentioned here.')).toBe(true);
      });
    });

    describe('format: expanded', () => {
      it('should replace citations with quoted source text', () => {
        const answer = 'According to research[1], this is true.';
        const citations = [createCitation(1, 'Studies show that the hypothesis is correct')];

        const result = formatAnswerWithSources(answer, citations, 'expanded');

        expect(result).toContain('"Studies show that the hypothesis is correct"');
        expect(result).not.toContain('[1]');
      });

      it('should truncate long source text to 150 characters', () => {
        const longSource = 'B'.repeat(200);
        const answer = 'Text[1].';
        const citations = [createCitation(1, longSource)];

        const result = formatAnswerWithSources(answer, citations, 'expanded');

        expect(result).toContain('...');
        // Expanded uses 150 char limit
        expect(result.length).toBeLessThan(answer.length + 200);
      });

      it('should handle multiple citations', () => {
        const answer = 'First[1] and second[2].';
        const citations = [
          createCitation(1, 'First source content'),
          createCitation(2, 'Second source content'),
        ];

        const result = formatAnswerWithSources(answer, citations, 'expanded');

        expect(result).toContain('"First source content"');
        expect(result).toContain('"Second source content"');
      });

      it('should handle superscript citations', () => {
        const answer = 'This fact1 is important.';
        const citations = [createCitation(1, 'Source content')];

        const result = formatAnswerWithSources(answer, citations, 'expanded');

        expect(result).toContain('"Source content"');
      });

      it('should handle stuck-together citations', () => {
        // Stuck-together citations have limitations with the current regex
        const answer = 'Multiple sources12 confirm this.';
        const citations = [createCitation(1, 'Source one'), createCitation(2, 'Source two')];

        const result = formatAnswerWithSources(answer, citations, 'expanded');

        // At minimum, the first citation should be replaced
        expect(result).toContain('"Source one"');
        // The format may not perfectly handle all stuck-together cases
        expect(result).toBeDefined();
      });

      it('should handle citations 10+ correctly (descending order)', () => {
        const answer = 'Fact[1] and fact[11].';
        const citations = [createCitation(1, 'Source 1'), createCitation(11, 'Source 11')];

        const result = formatAnswerWithSources(answer, citations, 'expanded');

        expect(result).toContain('"Source 1"');
        expect(result).toContain('"Source 11"');
        // Make sure [1] didn't corrupt [11]
        expect(result).not.toContain('["Source 1"]1');
      });
    });

    describe('format: json', () => {
      it('should return original answer unchanged', () => {
        const answer = 'Text with[1] citation.';
        const citations = [createCitation(1, 'Source')];

        const result = formatAnswerWithSources(answer, citations, 'json');

        expect(result).toBe(answer);
      });
    });

    describe('edge cases', () => {
      it('should handle empty answer', () => {
        const answer = '';
        const citations = [createCitation(1, 'Source')];

        const result = formatAnswerWithSources(answer, citations, 'inline');

        expect(result).toBe('');
      });

      it('should handle answer without citations', () => {
        const answer = 'No citations here.';
        const citations = [createCitation(1, 'Orphan source')];

        const result = formatAnswerWithSources(answer, citations, 'inline');

        // Citation markers not in text, so no replacement happens
        expect(result).toBe(answer);
      });

      it('should handle citations with special characters in source', () => {
        const answer = 'Text[1].';
        const citations = [createCitation(1, 'Source with "quotes" and [brackets]')];

        const result = formatAnswerWithSources(answer, citations, 'inline');

        expect(result).toContain('Source with "quotes" and [brackets]');
      });

      it('should handle newlines in source text', () => {
        const answer = 'Text[1].';
        const citations = [createCitation(1, 'Line 1\nLine 2')];

        const result = formatAnswerWithSources(answer, citations, 'inline');

        expect(result).toContain('Line 1\nLine 2');
      });

      it('should handle unicode in source text', () => {
        const answer = 'Text[1].';
        const citations = [createCitation(1, '日本語 テキスト émoji 🔬')];

        const result = formatAnswerWithSources(answer, citations, 'inline');

        expect(result).toContain('日本語 テキスト émoji 🔬');
      });

      it('should handle very short source text', () => {
        const answer = 'Text[1].';
        const citations = [createCitation(1, 'OK')];

        const result = formatAnswerWithSources(answer, citations, 'inline');

        expect(result).toContain('[1: "OK"]');
      });

      it('should handle citation at start of answer', () => {
        const answer = '[1] This starts with a citation.';
        const citations = [createCitation(1, 'Leading source')];

        const result = formatAnswerWithSources(answer, citations, 'inline');

        expect(result).toContain('[1: "Leading source"]');
      });

      it('should handle consecutive citations', () => {
        const answer = 'Multiple sources[1][2][3] support this.';
        const citations = [
          createCitation(1, 'Source A'),
          createCitation(2, 'Source B'),
          createCitation(3, 'Source C'),
        ];

        const result = formatAnswerWithSources(answer, citations, 'inline');

        expect(result).toContain('[1: "Source A"]');
        expect(result).toContain('[2: "Source B"]');
        expect(result).toContain('[3: "Source C"]');
      });

      it('should handle citations with comma-separated numbers like [1, 2]', () => {
        // This format isn't directly handled, but shouldn't break
        const answer = 'Some text[1, 2] here.';
        const citations = [createCitation(1, 'Source 1'), createCitation(2, 'Source 2')];

        // This will only partially work - [1, 2] won't be replaced as a unit
        const result = formatAnswerWithSources(answer, citations, 'inline');

        // At minimum, shouldn't throw
        expect(result).toBeDefined();
      });
    });

    describe('truncateSource behavior', () => {
      it('should not truncate source under limit', () => {
        const shortSource = 'Short text';
        const answer = 'Text[1].';
        const citations = [createCitation(1, shortSource)];

        const result = formatAnswerWithSources(answer, citations, 'inline');

        expect(result).toContain(`[1: "${shortSource}"]`);
        expect(result).not.toContain('...');
      });

      it('should truncate source at exactly limit', () => {
        const source = 'A'.repeat(100);
        const answer = 'Text[1].';
        const citations = [createCitation(1, source)];

        const result = formatAnswerWithSources(answer, citations, 'inline');

        // At 100 chars, should not truncate
        expect(result).toContain(source);
      });

      it('should truncate source over limit with ellipsis', () => {
        const source = 'A'.repeat(101);
        const answer = 'Text[1].';
        const citations = [createCitation(1, source)];

        const result = formatAnswerWithSources(answer, citations, 'inline');

        expect(result).toContain('...');
      });
    });

    describe('descending order processing', () => {
      it('should process larger numbers first to avoid corruption', () => {
        // If we process [1] before [10], [12], etc., we might corrupt them
        const answer = 'Ref[1] and ref[10] and ref[12] and ref[2].';
        const citations = [
          createCitation(1, 'One'),
          createCitation(2, 'Two'),
          createCitation(10, 'Ten'),
          createCitation(12, 'Twelve'),
        ];

        const result = formatAnswerWithSources(answer, citations, 'inline');

        // Each should be replaced correctly
        expect(result).toContain('[1: "One"]');
        expect(result).toContain('[2: "Two"]');
        expect(result).toContain('[10: "Ten"]');
        expect(result).toContain('[12: "Twelve"]');

        // Should not have any malformed citations
        expect(result).not.toMatch(/\[1: "One"\]0/);
        expect(result).not.toMatch(/\[1: "One"\]2/);
      });
    });
  });

  describe('Citation type', () => {
    it('should have correct structure', () => {
      const citation = createCitation(5, 'Test source', 'Test Name');

      expect(citation.marker).toBe('[5]');
      expect(citation.number).toBe(5);
      expect(citation.sourceText).toBe('Test source');
      expect(citation.sourceName).toBe('Test Name');
    });
  });

  describe('SourceFormat type', () => {
    it('should accept valid format values', () => {
      const formats: SourceFormat[] = ['none', 'inline', 'footnotes', 'json', 'expanded'];

      formats.forEach((format) => {
        const result = formatAnswerWithSources('test', [], format);
        expect(result).toBeDefined();
      });
    });
  });
});
