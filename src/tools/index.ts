/**
 * MCP Tool Implementations
 *
 * Implements all MCP tools for NotebookLM integration:
 * - ask_question: Ask NotebookLM with session support
 * - list_sessions: List all active sessions
 * - close_session: Close a specific session
 * - reset_session: Reset session chat history
 * - get_health: Server health check
 * - setup_auth: Interactive authentication setup
 * - add_source: Add document/source to notebook
 * - generate_content: Generate audio, briefing, study guide, etc.
 * - list_content: List sources and generated content
 *
 * Based on the Python implementation from tools/*.py
 */

import fs from 'fs';
import { SessionManager } from '../session/session-manager.js';
import { AuthManager } from '../auth/auth-manager.js';
import { NotebookLibrary } from '../library/notebook-library.js';
import { getAccountManager } from '../accounts/account-manager.js';
import { AutoLoginManager } from '../accounts/auto-login-manager.js';
import type {
  AddNotebookInput,
  UpdateNotebookInput,
  NotebookEntry,
  LibraryStats,
} from '../library/types.js';
import { CONFIG, applyBrowserOptions, type BrowserOptions } from '../config.js';
import { log } from '../utils/logger.js';
import type {
  AskQuestionResult,
  AskQuestionSuccess,
  SourceCitations,
  ToolResult,
  Tool,
  ProgressCallback,
  SourceFormat,
} from '../types.js';
import { RateLimitError } from '../errors.js';
import { CleanupManager } from '../utils/cleanup-manager.js';
import { randomDelay } from '../utils/stealth-utils.js';
import { ContentManager } from '../content/content-manager.js';
import { runBatchToVault, type BatchToVaultResult } from '../utils/vault-writer.js';
import type {
  SourceUploadResult,
  SourceDeleteResult,
  ContentGenerationResult,
  NotebookContentOverview,
  ContentDownloadResult,
  ContentType,
  SourceType,
  VideoStyle,
  VideoFormat,
  InfographicFormat,
  ReportFormat,
  PresentationStyle,
  PresentationLength,
  NoteResult,
  SaveChatToNoteResult,
  NoteToSourceResult,
} from '../content/types.js';

/**
 * Build dynamic tool description for ask_question based on active notebook or library
 */
function buildAskQuestionDescription(library: NotebookLibrary): string {
  const active = library.getActiveNotebook();

  if (active) {
    const topics = active.topics?.join(', ') || '';
    const useCases =
      active.use_cases?.map((uc) => `  - ${uc}`).join('\n') || '  - Research and exploration';

    return `# Conversational Research Partner (NotebookLM • Gemini 2.5 • Session RAG)

**Active Notebook:** ${active.name}
**Content:** ${active.description}
**Topics:** ${topics}

> Auth tip: If login is required, use the prompt 'notebooklm.auth-setup' and then verify with the 'get_health' tool. If authentication later fails (e.g., expired cookies), use the prompt 'notebooklm.auth-repair'.

## What This Tool Is
- Full conversational research with Gemini (LLM) grounded on your notebook sources
- Session-based: each follow-up uses prior context for deeper, more precise answers
- Source-cited responses designed to minimize hallucinations

## When To Use
${useCases}

## Rules (Important)
- Always prefer continuing an existing session for the same task
- If you start a new thread, create a new session and keep its session_id
- Ask clarifying questions before implementing; do not guess missing details
- If multiple notebooks could apply, propose the top 1–2 and ask which to use
- If task context changes, ask to reset the session or switch notebooks
- If authentication fails, use the prompts 'notebooklm.auth-repair' (or 'notebooklm.auth-setup') and verify with 'get_health'
- After every NotebookLM answer: pause, compare with the user's goal, and only respond if you are 100% sure the information is complete. Otherwise, plan the next NotebookLM question in the same session.

## Session Flow (Recommended)
\`\`\`javascript
// 1) Start broad (no session_id → creates one)
ask_question({ question: "Give me an overview of [topic]" })
// ← Save: result.session_id

// 2) Go specific (same session)
ask_question({ question: "Key APIs/methods?", session_id })

// 3) Cover pitfalls (same session)
ask_question({ question: "Common edge cases + gotchas?", session_id })

// 4) Ask for production example (same session)
ask_question({ question: "Show a production-ready example", session_id })
\`\`\`

## Automatic Multi-Pass Strategy (Host-driven)
- Simple prompts return once-and-done answers.
- For complex prompts, the host should issue follow-up calls:
  1. Implementation plan (APIs, dependencies, configuration, authentication).
  2. Pitfalls, gaps, validation steps, missing prerequisites.
- Keep the same session_id for all follow-ups, review NotebookLM's answer, and ask more questions until the problem is fully resolved.
- Before replying to the user, double-check: do you truly have everything? If not, queue another ask_question immediately.

## 🔥 REAL EXAMPLE

Task: "Implement error handling in n8n workflow"

Bad (shallow):
\`\`\`
Q: "How do I handle errors in n8n?"
A: [basic answer]
→ Implement → Probably missing edge cases!
\`\`\`

Good (deep):
\`\`\`
Q1: "What are n8n's error handling mechanisms?" (session created)
A1: [Overview of error handling]

Q2: "What's the recommended pattern for API errors?" (same session)
A2: [Specific patterns, uses context from Q1]

Q3: "How do I handle retry logic and timeouts?" (same session)
A3: [Detailed approach, builds on Q1+Q2]

Q4: "Show me a production example with all these patterns" (same session)
A4: [Complete example with full context]

→ NOW implement with confidence!
\`\`\`
    
## Notebook Selection
- Default: active notebook (${active.id})
- Or set notebook_id to use a library notebook
- Or set notebook_url for ad-hoc notebooks (not in library)
- If ambiguous which notebook fits, ASK the user which to use`;
  } else {
    return `# Conversational Research Partner (NotebookLM • Gemini 2.5 • Session RAG)

## No Active Notebook
- Visit https://notebooklm.google to create a notebook and get a share link
- Use **add_notebook** to add it to your library (explains how to get the link)
- Use **list_notebooks** to show available sources
- Use **select_notebook** to set one active

> Auth tip: If login is required, use the prompt 'notebooklm.auth-setup' and then verify with the 'get_health' tool. If authentication later fails (e.g., expired cookies), use the prompt 'notebooklm.auth-repair'.

Tip: Tell the user you can manage NotebookLM library and ask which notebook to use for the current task.`;
  }
}

/**
 * Build Tool Definitions with NotebookLibrary context
 */
export function buildToolDefinitions(library: NotebookLibrary): Tool[] {
  return [
    {
      name: 'ask_question',
      description: buildAskQuestionDescription(library),
      inputSchema: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'The question to ask NotebookLM',
          },
          session_id: {
            type: 'string',
            description:
              'Optional session ID for contextual conversations. If omitted, a new session is created.',
          },
          notebook_id: {
            type: 'string',
            description:
              'Optional notebook ID from your library. If omitted, uses the active notebook. ' +
              'Use list_notebooks to see available notebooks.',
          },
          notebook_url: {
            type: 'string',
            description:
              'Optional notebook URL (overrides notebook_id). Use this for ad-hoc queries to notebooks not in your library.',
          },
          show_browser: {
            type: 'boolean',
            description:
              'Show browser window for debugging (simple version). ' +
              'For advanced control (typing speed, stealth, etc.), use browser_options instead.',
          },
          source_format: {
            type: 'string',
            enum: ['none', 'inline', 'footnotes', 'json', 'expanded'],
            description:
              'Format for source citation extraction (default: none). Options:\n' +
              '- none: No source extraction (fastest)\n' +
              '- inline: Insert source text inline: "text [1: source excerpt]"\n' +
              '- footnotes: Append sources at the end as footnotes\n' +
              '- json: Return sources as separate object in response\n' +
              '- expanded: Replace [1] with full quoted source text\n\n' +
              'Note: Source extraction adds ~1-2 seconds but does NOT consume additional NotebookLM quota.',
          },
          browser_options: {
            type: 'object',
            description:
              'Optional browser behavior settings. Claude can control everything: ' +
              'visibility, typing speed, stealth mode, timeouts. Useful for debugging or fine-tuning.',
            properties: {
              show: {
                type: 'boolean',
                description: 'Show browser window (default: from ENV or false)',
              },
              headless: {
                type: 'boolean',
                description: 'Run browser in headless mode (default: true)',
              },
              timeout_ms: {
                type: 'number',
                description: 'Browser operation timeout in milliseconds (default: 30000)',
              },
              stealth: {
                type: 'object',
                description: 'Human-like behavior settings to avoid detection',
                properties: {
                  enabled: {
                    type: 'boolean',
                    description: 'Master switch for all stealth features (default: true)',
                  },
                  random_delays: {
                    type: 'boolean',
                    description: 'Random delays between actions (default: true)',
                  },
                  human_typing: {
                    type: 'boolean',
                    description: 'Human-like typing patterns (default: true)',
                  },
                  mouse_movements: {
                    type: 'boolean',
                    description: 'Realistic mouse movements (default: true)',
                  },
                  typing_wpm_min: {
                    type: 'number',
                    description: 'Minimum typing speed in WPM (default: 160)',
                  },
                  typing_wpm_max: {
                    type: 'number',
                    description: 'Maximum typing speed in WPM (default: 240)',
                  },
                  delay_min_ms: {
                    type: 'number',
                    description: 'Minimum delay between actions in ms (default: 100)',
                  },
                  delay_max_ms: {
                    type: 'number',
                    description: 'Maximum delay between actions in ms (default: 400)',
                  },
                },
              },
              viewport: {
                type: 'object',
                description: 'Browser viewport size',
                properties: {
                  width: {
                    type: 'number',
                    description: 'Viewport width in pixels (default: 1920)',
                  },
                  height: {
                    type: 'number',
                    description: 'Viewport height in pixels (default: 1080)',
                  },
                },
              },
            },
          },
        },
        required: ['question'],
      },
    },
    {
      name: 'auto_discover_notebook',
      description: `🚀 AUTO-DISCOVERY — Automatically generate notebook metadata via NotebookLM (RECOMMENDED)

## When to Use
- User provides NotebookLM URL and wants quick/automatic setup
- User prefers not to manually specify metadata
- Default choice for adding notebooks

## Workflow
1) User provides NotebookLM URL
2) Ask confirmation: "Add '[URL]' with auto-generated metadata?"
3) Call this tool → NotebookLM generates name, description, tags
4) Show generated metadata to user for review

## Benefits
- ✅ 30 seconds vs 5 minutes manual entry
- ✅ Zero-friction notebook addition
- ✅ Consistent metadata quality
- ✅ Discovers topics user might not think of

## Example
User: "Add this NotebookLM: https://notebooklm.google.com/notebook/abc123"
You: "Add this notebook with auto-generated metadata?"
User: "Yes"
You: Call auto_discover_notebook(url="https://...")
→ Returns: {name: "n8n-workflow-guide", description: "...", tags: [...]}

## Fallback
If auto-discovery fails (rare), use add_notebook tool for manual entry.

## How to Get a NotebookLM Share Link

Visit https://notebooklm.google/ → Login (free: 100 notebooks, 50 sources each, 500k words, 50 daily queries)
1) Click "+ New" (top right) → Upload sources (docs, knowledge)
2) Click "Share" (top right) → Select "Anyone with the link"
3) Click "Copy link" (bottom left) → Give this link to Claude

(Upgraded: Google AI Pro/Ultra gives 5x higher limits)`,
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The NotebookLM notebook URL',
          },
        },
        required: ['url'],
      },
    },
    {
      name: 'add_notebook',
      description: `📝 MANUAL ENTRY — Add notebook with manually specified metadata (use auto_discover_notebook instead)

## When to Use
- Auto-discovery failed or unavailable
- User has specific metadata requirements
- User prefers manual control

## Conversation Workflow (Mandatory)
When the user says: "I have a NotebookLM with X"

**FIRST:** Try auto_discover_notebook for faster setup
**ONLY IF** user refuses auto-discovery or it fails:

1) Ask URL: "What is the NotebookLM URL?"
2) Ask content: "What knowledge is inside?" (1–2 sentences)
3) Ask topics: "Which topics does it cover?" (3–5)
4) Ask use cases: "When should we consult it?"
5) Propose metadata and confirm:
   - Name: [suggested]
   - Description: [from user]
   - Topics: [list]
   - Use cases: [list]
   "Add it to your library now?"
6) Only after explicit "Yes" → call this tool

## Rules
- Do not add without user permission
- Prefer auto_discover_notebook when possible
- Do not guess metadata — ask concisely
- Confirm summary before calling the tool

## Example
User: "I have a notebook with n8n docs"
You: "Want me to auto-generate the metadata?" (offer auto_discover_notebook first)
User: "No, I'll specify it myself"
You: Ask URL → content → topics → use cases; propose summary
User: "Yes"
You: Call add_notebook

## How to Get a NotebookLM Share Link

Visit https://notebooklm.google/ → Login (free: 100 notebooks, 50 sources each, 500k words, 50 daily queries)
1) Click "+ New" (top right) → Upload sources (docs, knowledge)
2) Click "Share" (top right) → Select "Anyone with the link"
3) Click "Copy link" (bottom left) → Give this link to Claude

(Upgraded: Google AI Pro/Ultra gives 5x higher limits)`,
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The NotebookLM notebook URL',
          },
          name: {
            type: 'string',
            description: "Display name for the notebook (e.g., 'n8n Documentation')",
          },
          description: {
            type: 'string',
            description: 'What knowledge/content is in this notebook',
          },
          topics: {
            type: 'array',
            items: { type: 'string' },
            description: 'Topics covered in this notebook',
          },
          content_types: {
            type: 'array',
            items: { type: 'string' },
            description: "Types of content (e.g., ['documentation', 'examples', 'best practices'])",
          },
          use_cases: {
            type: 'array',
            items: { type: 'string' },
            description:
              "When should Claude use this notebook (e.g., ['Implementing n8n workflows'])",
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional tags for organization',
          },
        },
        required: ['url', 'name', 'description', 'topics'],
      },
    },
    {
      name: 'list_notebooks',
      description:
        'List all library notebooks with metadata (name, topics, use cases, URL). ' +
        'Use this to present options, then ask which notebook to use for the task.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'get_notebook',
      description: 'Get detailed information about a specific notebook by ID',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The notebook ID',
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'select_notebook',
      description: `Set a notebook as the active default (used when ask_question has no notebook_id).

## When To Use
- User switches context: "Let's work on React now"
- User asks explicitly to activate a notebook
- Obvious task change requires another notebook

## Auto-Switching
- Safe to auto-switch if the context is clear and you announce it:
  "Switching to React notebook for this task..."
- If ambiguous, ask: "Switch to [notebook] for this task?"

## Example
User: "Now let's build the React frontend"
You: "Switching to React notebook..." (call select_notebook)`,
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The notebook ID to activate',
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'update_notebook',
      description: `Update notebook metadata based on user intent.

## Pattern
1) Identify target notebook and fields (topics, description, use_cases, tags, url)
2) Propose the exact change back to the user
3) After explicit confirmation, call this tool

## Examples
- User: "React notebook also covers Next.js 14"
  You: "Add 'Next.js 14' to topics for React?"
  User: "Yes" → call update_notebook

- User: "Include error handling in n8n description"
  You: "Update the n8n description to mention error handling?"
  User: "Yes" → call update_notebook

Tip: You may update multiple fields at once if requested.`,
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The notebook ID to update',
          },
          name: {
            type: 'string',
            description: 'New display name',
          },
          description: {
            type: 'string',
            description: 'New description',
          },
          topics: {
            type: 'array',
            items: { type: 'string' },
            description: 'New topics list',
          },
          content_types: {
            type: 'array',
            items: { type: 'string' },
            description: 'New content types',
          },
          use_cases: {
            type: 'array',
            items: { type: 'string' },
            description: 'New use cases',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'New tags',
          },
          url: {
            type: 'string',
            description: 'New notebook URL',
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'remove_notebook',
      description: `Dangerous — requires explicit user confirmation.

## Confirmation Workflow
1) User requests removal ("Remove the React notebook")
2) Look up full name to confirm
3) Ask: "Remove '[notebook_name]' from your library? (Does not delete the actual NotebookLM notebook)"
4) Only on explicit "Yes" → call remove_notebook

Never remove without permission or based on assumptions.

Example:
User: "Delete the old React notebook"
You: "Remove 'React Best Practices' from your library?"
User: "Yes" → call remove_notebook`,
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The notebook ID to remove',
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'search_notebooks',
      description:
        'Search library by query (name, description, topics, tags). ' +
        'Use to propose relevant notebooks for the task and then ask which to use.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'get_library_stats',
      description: 'Get statistics about your notebook library (total notebooks, usage, etc.)',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'list_sessions',
      description:
        'List all active sessions with stats (age, message count, last activity). ' +
        'Use to continue the most relevant session instead of starting from scratch.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'close_session',
      description:
        'Close a specific session by session ID. Ask before closing if the user might still need it.',
      inputSchema: {
        type: 'object',
        properties: {
          session_id: {
            type: 'string',
            description: 'The session ID to close',
          },
        },
        required: ['session_id'],
      },
    },
    {
      name: 'reset_session',
      description:
        "Reset a session's chat history (keep same session ID). " +
        'Use for a clean slate when the task changes; ask the user before resetting.',
      inputSchema: {
        type: 'object',
        properties: {
          session_id: {
            type: 'string',
            description: 'The session ID to reset',
          },
        },
        required: ['session_id'],
      },
    },
    {
      name: 'get_health',
      description:
        'Get server health status including authentication state, active sessions, and configuration. ' +
        'Use this to verify the server is ready before starting research workflows.\n\n' +
        'If authenticated=false and having persistent issues:\n' +
        'Consider running cleanup_data(preserve_library=true) + setup_auth for fresh start with clean browser session.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'setup_auth',
      description:
        'Google authentication for NotebookLM access - opens a browser window for manual login to your Google account. ' +
        'Returns immediately after opening the browser. You have up to 10 minutes to complete the login. ' +
        "Use 'get_health' tool afterwards to verify authentication was saved successfully. " +
        'Use this for first-time authentication or when auto-login credentials are not available. ' +
        'IMPORTANT: If already authenticated, this tool will skip re-authentication. ' +
        "For switching accounts or rate-limit workarounds, use 're_auth' tool instead.\n\n" +
        'TROUBLESHOOTING for persistent auth issues:\n' +
        'If setup_auth fails or you encounter browser/session issues:\n' +
        '1. Ask user to close ALL Chrome/Chromium instances\n' +
        '2. Run cleanup_data(confirm=true, preserve_library=true) to clean old data\n' +
        '3. Run setup_auth again for fresh start\n' +
        'This helps resolve conflicts from old browser sessions and installation data.',
      inputSchema: {
        type: 'object',
        properties: {
          show_browser: {
            type: 'boolean',
            description:
              'Show browser window (simple version). Default: true for setup. ' +
              'For advanced control, use browser_options instead.',
          },
          browser_options: {
            type: 'object',
            description:
              'Optional browser settings. Control visibility, timeouts, and stealth behavior.',
            properties: {
              show: {
                type: 'boolean',
                description: 'Show browser window (default: true for setup)',
              },
              headless: {
                type: 'boolean',
                description: 'Run browser in headless mode (default: false for setup)',
              },
              timeout_ms: {
                type: 'number',
                description: 'Browser operation timeout in milliseconds (default: 30000)',
              },
            },
          },
        },
      },
    },
    {
      name: 'de_auth',
      description:
        'De-authenticate (logout) - Clears all authentication data for security. ' +
        'Use this when:\n' +
        '- User wants to log out for security reasons\n' +
        '- Removing credentials before shutting down\n' +
        '- Clearing auth without immediately re-authenticating\n\n' +
        'This will:\n' +
        '1. Close all active browser sessions\n' +
        '2. Delete all saved authentication data (cookies, Chrome profile)\n' +
        '3. Preserve notebook library and other data\n\n' +
        'IMPORTANT: After de_auth, the server will need re-authentication via setup_auth or re_auth before making queries.\n\n' +
        "Use 'get_health' to verify de-authentication was successful (authenticated: false).",
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 're_auth',
      description:
        'Switch to a different Google account or re-authenticate. ' +
        'Use this when:\n' +
        '- NotebookLM rate limit is reached (50 queries/day for free accounts)\n' +
        '- You want to switch to a different Google account\n' +
        '- Authentication is broken and needs a fresh start\n\n' +
        'This will:\n' +
        '1. Close all active browser sessions\n' +
        '2. Delete all saved authentication data (cookies, Chrome profile)\n' +
        '3. Open browser for fresh Google login\n\n' +
        "After completion, use 'get_health' to verify authentication.\n\n" +
        'TROUBLESHOOTING for persistent auth issues:\n' +
        'If re_auth fails repeatedly:\n' +
        '1. Ask user to close ALL Chrome/Chromium instances\n' +
        '2. Run cleanup_data(confirm=false, preserve_library=true) to preview old files\n' +
        '3. Run cleanup_data(confirm=true, preserve_library=true) to clean everything except library\n' +
        '4. Run re_auth again for completely fresh start\n' +
        'This removes old installation data and browser sessions that can cause conflicts.',
      inputSchema: {
        type: 'object',
        properties: {
          show_browser: {
            type: 'boolean',
            description:
              'Show browser window (simple version). Default: true for re-auth. ' +
              'For advanced control, use browser_options instead.',
          },
          browser_options: {
            type: 'object',
            description:
              'Optional browser settings. Control visibility, timeouts, and stealth behavior.',
            properties: {
              show: {
                type: 'boolean',
                description: 'Show browser window (default: true for re-auth)',
              },
              headless: {
                type: 'boolean',
                description: 'Run browser in headless mode (default: false for re-auth)',
              },
              timeout_ms: {
                type: 'number',
                description: 'Browser operation timeout in milliseconds (default: 30000)',
              },
            },
          },
        },
      },
    },
    {
      name: 'cleanup_data',
      description:
        'ULTRATHINK Deep Cleanup - Scans entire system for ALL NotebookLM MCP data files across 8 categories. Always runs in deep mode, shows categorized preview before deletion.\n\n' +
        '⚠️ CRITICAL: Close ALL Chrome/Chromium instances BEFORE running this tool! Open browsers can prevent cleanup and cause issues.\n\n' +
        'Categories scanned:\n' +
        '1. Legacy Installation (notebooklm-mcp-nodejs) - Old paths with -nodejs suffix\n' +
        '2. Current Installation (notebooklm-mcp) - Active data, browser profiles, library\n' +
        '3. NPM/NPX Cache - Cached installations from npx\n' +
        '4. Claude CLI MCP Logs - MCP server logs from Claude CLI\n' +
        '5. Temporary Backups - Backup directories in system temp\n' +
        '6. Claude Projects Cache - Project-specific cache (optional)\n' +
        '7. Editor Logs (Cursor/VSCode) - MCP logs from code editors (optional)\n' +
        '8. Trash Files - Deleted notebooklm files in system trash (optional)\n\n' +
        'Works cross-platform (Linux, Windows, macOS). Safe by design: shows detailed preview before deletion, requires explicit confirmation.\n\n' +
        'LIBRARY PRESERVATION: Set preserve_library=true to keep your notebook library.json file while cleaning everything else.\n\n' +
        'RECOMMENDED WORKFLOW for fresh start:\n' +
        '1. Ask user to close ALL Chrome/Chromium instances\n' +
        '2. Run cleanup_data(confirm=false, preserve_library=true) to preview\n' +
        '3. Run cleanup_data(confirm=true, preserve_library=true) to execute\n' +
        '4. Run setup_auth or re_auth for fresh browser session\n\n' +
        'Use cases: Clean reinstall, troubleshooting auth issues, removing all traces before uninstall, cleaning old browser sessions and installation data.',
      inputSchema: {
        type: 'object',
        properties: {
          confirm: {
            type: 'boolean',
            description:
              'Confirmation flag. Tool shows preview first, then user confirms deletion. ' +
              'Set to true only after user has reviewed the preview and explicitly confirmed.',
          },
          preserve_library: {
            type: 'boolean',
            description:
              'Preserve library.json file during cleanup. Default: false. ' +
              'Set to true to keep your notebook library while deleting everything else (browser data, caches, logs).',
            default: false,
          },
        },
        required: ['confirm'],
      },
    },
    // ========================================================================
    // Content Management Tools
    // ========================================================================
    {
      name: 'add_source',
      description:
        'Add a source (document, URL, text, YouTube video) to the current NotebookLM notebook.\n\n' +
        'Supported source types:\n' +
        '- file: Upload a local file (PDF, DOCX, TXT, etc.)\n' +
        '- url: Add a web page URL\n' +
        '- text: Paste text content directly\n' +
        '- youtube: Add a YouTube video URL\n' +
        '- google_drive: Add a Google Drive document link\n\n' +
        'The source will be processed and indexed for use in conversations.',
      inputSchema: {
        type: 'object',
        properties: {
          source_type: {
            type: 'string',
            enum: ['file', 'url', 'text', 'youtube', 'google_drive'],
            description: 'Type of source to add',
          },
          file_path: {
            type: 'string',
            description: 'Local file path (required for source_type="file")',
          },
          url: {
            type: 'string',
            description: 'URL (required for source_type="url", "youtube", "google_drive")',
          },
          text: {
            type: 'string',
            description: 'Text content (required for source_type="text")',
          },
          title: {
            type: 'string',
            description: 'Optional title/name for the source',
          },
          notebook_url: {
            type: 'string',
            description: 'Notebook URL. If not provided, uses the active notebook.',
          },
          session_id: {
            type: 'string',
            description: 'Session ID to reuse an existing session',
          },
        },
        required: ['source_type'],
      },
    },
    {
      name: 'delete_source',
      description:
        'Delete a source from the current NotebookLM notebook.\n\n' +
        'You can identify the source to delete by either:\n' +
        '- source_id: The unique identifier of the source\n' +
        '- source_name: The name/title of the source (partial match supported)\n\n' +
        'Use list_content first to see available sources and their IDs/names.\n\n' +
        'WARNING: This action is irreversible. The source will be permanently removed from the notebook.',
      inputSchema: {
        type: 'object',
        properties: {
          source_id: {
            type: 'string',
            description: 'The unique ID of the source to delete',
          },
          source_name: {
            type: 'string',
            description: 'The name/title of the source to delete (partial match supported)',
          },
          notebook_url: {
            type: 'string',
            description: 'Notebook URL. If not provided, uses the active notebook.',
          },
          session_id: {
            type: 'string',
            description: 'Session ID to reuse an existing session',
          },
        },
      },
    },
    {
      name: 'generate_content',
      description:
        'Generate content from your NotebookLM sources.\n\n' +
        'Supported content types:\n' +
        '- audio_overview: Audio podcast/overview (Deep Dive conversation with two AI hosts)\n' +
        '- video: Video summary that visually explains main topics (brief or explainer format)\n' +
        '- presentation: Slides/presentation with AI-generated content and images\n' +
        '- report: Briefing document (2,000-3,000 words) summarizing key findings, exportable as PDF/DOCX\n' +
        '- infographic: Visual infographic in horizontal (16:9) or vertical (9:16) format\n' +
        '- data_table: Structured table organizing key information (exportable as CSV/Excel)\n\n' +
        'Language support: All content types support 80+ languages via the language parameter.\n\n' +
        'Video styles: Video content supports 6 visual styles via the video_style parameter:\n' +
        'classroom, documentary, animated, corporate, cinematic, minimalist.\n\n' +
        'These content types use real NotebookLM Studio UI buttons or the generic ContentGenerator ' +
        'architecture that navigates the Studio panel and falls back to chat-based generation.\n\n' +
        'NOTE: Other content types (faq, study_guide, timeline, table_of_contents) ' +
        'are NOT currently implemented. For document-style content, use the ask_question tool.',
      inputSchema: {
        type: 'object',
        properties: {
          content_type: {
            type: 'string',
            enum: [
              'audio_overview',
              'video',
              'presentation',
              'report',
              'infographic',
              'data_table',
            ],
            description:
              'Type of content to generate: audio_overview (podcast), video (brief or explainer), presentation (slides), report (briefing doc 2,000-3,000 words, PDF/DOCX export), infographic (horizontal 16:9 or vertical 9:16), or data_table (CSV/Excel export)',
          },
          custom_instructions: {
            type: 'string',
            description: 'Optional instructions to customize the generated content',
          },
          language: {
            type: 'string',
            description:
              'Language for the generated content (e.g., "French", "Spanish", "Japanese"). NotebookLM supports 80+ languages.',
          },
          video_style: {
            type: 'string',
            enum: ['classroom', 'documentary', 'animated', 'corporate', 'cinematic', 'minimalist'],
            description:
              'Visual style for video content (only valid for content_type="video"). Powered by Nano Banana AI.',
          },
          notebook_url: {
            type: 'string',
            description: 'Notebook URL. If not provided, uses the active notebook.',
          },
          session_id: {
            type: 'string',
            description: 'Session ID to reuse an existing session',
          },
        },
        required: ['content_type'],
      },
    },
    {
      name: 'list_content',
      description:
        'List all sources and generated content in the current notebook.\n\n' +
        'Returns:\n' +
        '- Sources: Documents, URLs, and other uploaded materials\n' +
        '- Generated content: Audio overviews',
      inputSchema: {
        type: 'object',
        properties: {
          notebook_url: {
            type: 'string',
            description: 'Notebook URL. If not provided, uses the active notebook.',
          },
          session_id: {
            type: 'string',
            description: 'Session ID to reuse an existing session',
          },
        },
      },
    },
    {
      name: 'download_content',
      description:
        'Download or export generated content from NotebookLM.\n\n' +
        'Supported content types:\n' +
        '- audio_overview: Downloads as audio file (MP3)\n' +
        '- video: Downloads as video file\n' +
        '- infographic: Downloads as image file\n' +
        '- presentation: Exports to Google Slides (returns URL)\n' +
        '- data_table: Exports to Google Sheets (returns URL)\n\n' +
        'Note: Report content is text-based and returned in the generation response.',
      inputSchema: {
        type: 'object',
        properties: {
          content_type: {
            type: 'string',
            enum: ['audio_overview', 'video', 'infographic', 'presentation', 'data_table'],
            description: 'Type of content to download/export',
          },
          output_path: {
            type: 'string',
            description: 'Optional local path to save the file (for audio, video, infographic)',
          },
          notebook_url: {
            type: 'string',
            description: 'Notebook URL. If not provided, uses the active notebook.',
          },
          session_id: {
            type: 'string',
            description: 'Session ID to reuse an existing session',
          },
        },
        required: ['content_type'],
      },
    },
    {
      name: 'create_note',
      description:
        'Create a note in the NotebookLM Studio panel.\n\n' +
        'Notes are user-created annotations that appear in your notebook. ' +
        'Use them to save research findings, summaries, key insights, or any ' +
        'custom content you want to keep alongside your sources.\n\n' +
        'Notes support markdown formatting for rich text content.',
      inputSchema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Title of the note (required)',
          },
          content: {
            type: 'string',
            description: 'Content/body of the note. Supports markdown formatting.',
          },
          notebook_url: {
            type: 'string',
            description: 'Notebook URL. If not provided, uses the active notebook.',
          },
          session_id: {
            type: 'string',
            description: 'Session ID to reuse an existing session',
          },
        },
        required: ['title', 'content'],
      },
    },
    {
      name: 'save_chat_to_note',
      description:
        'Save the current NotebookLM chat/discussion to a note.\n\n' +
        'This tool extracts all messages from the current conversation (both user questions ' +
        'and NotebookLM AI responses) and saves them as a formatted note in the Studio panel.\n\n' +
        'Use this to:\n' +
        '- Preserve important research conversations\n' +
        '- Create a summary of your discussion with NotebookLM\n' +
        '- Save chat history before starting a new topic\n\n' +
        'The note will include timestamps and message attribution (User/NotebookLM).',
      inputSchema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Custom title for the note (default: "Chat Summary")',
          },
          notebook_url: {
            type: 'string',
            description: 'Notebook URL. If not provided, uses the active notebook.',
          },
          session_id: {
            type: 'string',
            description: 'Session ID to reuse an existing session',
          },
        },
      },
    },
    {
      name: 'convert_note_to_source',
      description:
        'Convert a note to a source document in NotebookLM.\n\n' +
        'This feature allows you to convert an existing note into a source, ' +
        'making the note content available for RAG queries and research.\n\n' +
        'The method:\n' +
        '1. Finds the note by title in the Studio panel\n' +
        '2. Attempts to use NotebookLM\'s native "Convert to source" feature if available\n' +
        '3. Falls back to extracting note content and creating a text source if not\n\n' +
        "Use this when you want your note content to be included in NotebookLM's " +
        'knowledge base for answering questions.',
      inputSchema: {
        type: 'object',
        properties: {
          note_title: {
            type: 'string',
            description: 'Title of the note to convert (required)',
          },
          notebook_url: {
            type: 'string',
            description: 'Notebook URL. If not provided, uses the active notebook.',
          },
          session_id: {
            type: 'string',
            description: 'Session ID to reuse an existing session',
          },
        },
        required: ['note_title'],
      },
    },
    // ========================================================================
    // Batch / Vault Tools
    // ========================================================================
    {
      name: 'batch_to_vault',
      description:
        'Run a list of questions against a notebook and persist each answer to disk as ' +
        'two artifacts: `{slug}.md` (markdown with YAML frontmatter, answer body and ' +
        'cited source excerpts) and `{slug}.json` (structured payload conforming to the ' +
        'nblm-answer-v1 schema). Designed for one-shot ingestion of a notebook into a ' +
        'searchable markdown vault (e.g. for indexing with RTFM) — every answer keeps ' +
        'titles + highlighted excerpts, so repeat queries no longer need to round-trip ' +
        'through NotebookLM.\n\n' +
        'Reuses the same browser/session as ask_question — no HTTP server required. ' +
        'Pass `sleep_between_ms` (1500–3000ms) for batches above ~20 questions to avoid ' +
        'hammering NotebookLM.\n\n' +
        'Returns per-question file paths, success flags, citation counts and the resolved ' +
        'session id. See the RTFM integration guide for the recommended workflow.',
      inputSchema: {
        type: 'object',
        properties: {
          questions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Non-empty array of question strings to ask sequentially.',
          },
          vault_dir: {
            type: 'string',
            description:
              'Destination directory (absolute or relative). Created with mkdir -p if missing.',
          },
          notebook_id: {
            type: 'string',
            description:
              'Optional library notebook id to query. Falls back to the active notebook.',
          },
          notebook_url: {
            type: 'string',
            description:
              'Optional NotebookLM URL (overrides notebook_id). Use for ad-hoc notebooks.',
          },
          slug_prefix: {
            type: 'string',
            description: 'Optional filename prefix (e.g. "sota", "market-2026q2"). Default: "".',
          },
          source_format: {
            type: 'string',
            enum: ['none', 'inline', 'footnotes', 'json', 'expanded'],
            description:
              'Citation extraction mode. "json" (default) preserves titles + excerpts in the sidecar.',
          },
          sleep_between_ms: {
            type: 'number',
            description: 'Pause between questions in ms. 1500–3000 is sane for batches above ~20.',
          },
          session_id: {
            type: 'string',
            description: 'Optional session id to reuse for context continuity across the batch.',
          },
        },
        required: ['questions', 'vault_dir'],
      },
    },
    // ========================================================================
    // Browser Scraping Tools (Real NotebookLM Data)
    // ========================================================================
    {
      name: 'list_notebooks_from_nblm',
      description:
        'Scrape the NotebookLM homepage to get a real list of all notebooks with their IDs and names.\n\n' +
        'This tool navigates to notebooklm.google.com and extracts:\n' +
        '- Notebook ID (UUID from URL)\n' +
        '- Notebook name (displayed title)\n' +
        '- Notebook URL\n\n' +
        'Use this to:\n' +
        '- Discover notebooks not yet in your library\n' +
        '- Get accurate notebook IDs for automation\n' +
        '- Verify which notebooks exist in your account\n' +
        '- Find notebooks to delete when cleanup is needed\n\n' +
        'Note: Requires authentication. Run setup_auth first if not authenticated.',
      inputSchema: {
        type: 'object',
        properties: {
          show_browser: {
            type: 'boolean',
            description: 'Show browser window during scraping. Default: false (headless).',
          },
        },
      },
    },
    {
      name: 'create_notebook',
      description:
        'Create a brand-new empty notebook directly in NotebookLM (no pre-existing URL required, ' +
        'unlike `add_notebook` which only registers an already-created notebook into the library).\n\n' +
        'Returns `{ notebook_url, notebook_id, name_applied, actual_name, message }`.\n' +
        '- `notebook_url` / `notebook_id`: always the FINAL UUID-based URL (the tool waits past the ' +
        '`/notebook/creating/c` transitional URL).\n' +
        '- `name_applied` (boolean): whether the `name` parameter actually took effect. ' +
        '`false` means the notebook is still "Untitled notebook" — rename via UI if needed.\n' +
        '- `actual_name` (string): the title observed on the notebook after creation.\n\n' +
        'Typical workflow:\n' +
        '1) `create_notebook({ name?: "my-research" })` → `{ notebook_url, notebook_id, name_applied, actual_name }`\n' +
        '2) `add_source({ notebook_url, source_type: "url", source: "https://..." })`\n' +
        '3) `ask_question({ notebook_url, question: "..." })`\n\n' +
        'Note: Requires authentication. Run `setup_auth` first if not authenticated.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description:
              'Optional initial title for the notebook. NotebookLM will auto-name it if omitted ' +
              '(usually "Untitled notebook"). The title can be edited later via the UI.',
          },
          show_browser: {
            type: 'boolean',
            description: 'Show browser window during creation. Default: false (headless).',
          },
        },
      },
    },
    {
      name: 'delete_notebooks_from_nblm',
      description:
        'Delete one or more notebooks directly from NotebookLM (UI-level deletion, ' +
        'not just from the local library). Pass an array of notebook IDs (UUIDs from ' +
        '`list_notebooks_from_nblm`).\n\n' +
        'Returns `{ deleted: [...], failed: [...] }` so the caller can retry or report on partial failures.\n\n' +
        'Use this to:\n' +
        '- Bulk-clean up a NotebookLM account (e.g. test notebooks from automation runs)\n' +
        '- Free up the 100-notebook free-tier quota\n' +
        '- Remove notebooks no longer covered by your sources\n\n' +
        'Warning: This is irreversible at the NotebookLM side. Confirm with the user before calling.\n' +
        'Note: Requires authentication. Run `setup_auth` first if not authenticated.',
      inputSchema: {
        type: 'object',
        properties: {
          notebook_ids: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Array of NotebookLM notebook IDs (UUIDs) to delete. Use `list_notebooks_from_nblm` ' +
              'to discover them.',
          },
          show_browser: {
            type: 'boolean',
            description: 'Show browser window during deletion. Default: false (headless).',
          },
        },
        required: ['notebook_ids'],
      },
    },
  ];
}

/**
 * MCP Tool Handlers
 */
export class ToolHandlers {
  private sessionManager: SessionManager;
  private authManager: AuthManager;
  private library: NotebookLibrary;

  constructor(sessionManager: SessionManager, authManager: AuthManager, library: NotebookLibrary) {
    this.sessionManager = sessionManager;
    this.authManager = authManager;
    this.library = library;
  }

  /**
   * Handle ask_question tool
   */
  async handleAskQuestion(
    args: {
      question: string;
      session_id?: string;
      notebook_id?: string;
      notebook_url?: string;
      show_browser?: boolean;
      source_format?: SourceFormat;
      browser_options?: BrowserOptions;
    },
    sendProgress?: ProgressCallback
  ): Promise<ToolResult<AskQuestionResult>> {
    const {
      question,
      session_id,
      notebook_id,
      notebook_url,
      show_browser,
      source_format = 'none',
      browser_options,
    } = args;

    log.info(`🔧 [TOOL] ask_question called`);
    log.info(`  Question: "${question.substring(0, 100)}..."`);
    if (session_id) {
      log.info(`  Session ID: ${session_id}`);
    }
    if (notebook_id) {
      log.info(`  Notebook ID: ${notebook_id}`);
    }
    if (notebook_url) {
      log.info(`  Notebook URL: ${notebook_url}`);
    }
    if (source_format !== 'none') {
      log.info(`  Source format: ${source_format}`);
    }

    try {
      // Resolve notebook URL
      let resolvedNotebookUrl = notebook_url;

      if (!resolvedNotebookUrl && notebook_id) {
        const notebook = this.library.incrementUseCount(notebook_id);
        if (!notebook) {
          const allNotebooks = this.library.listNotebooks();
          if (allNotebooks.length === 0) {
            throw new Error(
              `Notebook not found: '${notebook_id}'\n\n` +
                `❌ No notebooks configured in library.\n\n` +
                `To add a notebook:\n` +
                `  POST /notebooks with { url, name, description, topics }\n\n` +
                `Or use notebook_url directly in your request:\n` +
                `  { "question": "...", "notebook_url": "https://notebooklm.google.com/notebook/..." }`
            );
          } else {
            const availableIds = allNotebooks.map((n) => n.id).join(', ');
            throw new Error(
              `Notebook not found: '${notebook_id}'\n\n` +
                `Available notebooks: ${availableIds}\n\n` +
                `To list all notebooks: GET /notebooks\n` +
                `To add a new notebook: POST /notebooks`
            );
          }
        }

        resolvedNotebookUrl = notebook.url;
        log.info(`  Resolved notebook: ${notebook.name}`);
      } else if (!resolvedNotebookUrl) {
        const active = this.library.getActiveNotebook();
        if (active) {
          const notebook = this.library.incrementUseCount(active.id);
          if (!notebook) {
            throw new Error(`Active notebook not found: ${active.id}`);
          }
          resolvedNotebookUrl = notebook.url;
          log.info(`  Using active notebook: ${notebook.name}`);
        } else {
          // No notebook_url, no notebook_id, and no active notebook
          const allNotebooks = this.library.listNotebooks();
          if (allNotebooks.length === 0) {
            throw new Error(
              `❌ No notebook specified and no notebooks configured in library.\n\n` +
                `Please either:\n` +
                `1. Add a notebook to the library:\n` +
                `   POST /notebooks with { url, name, description, topics }\n\n` +
                `2. Or specify notebook_url in your request:\n` +
                `   { "question": "...", "notebook_url": "https://notebooklm.google.com/notebook/..." }\n\n` +
                `3. Or specify notebook_id from existing notebooks:\n` +
                `   GET /notebooks to list available notebooks`
            );
          } else {
            const availableIds = allNotebooks.map((n) => `${n.id} (${n.name})`).join('\n   - ');
            throw new Error(
              `❌ No notebook specified.\n\n` +
                `Available notebooks:\n   - ${availableIds}\n\n` +
                `Please specify one of:\n` +
                `  - notebook_id: "${allNotebooks[0].id}"\n` +
                `  - notebook_url: "https://notebooklm.google.com/notebook/..."\n\n` +
                `Or set an active notebook: PUT /notebooks/${allNotebooks[0].id}/activate`
            );
          }
        }
      }

      // Progress: Getting or creating session
      await sendProgress?.('Getting or creating browser session...', 1, 5);

      // Apply browser options temporarily
      // NOTE: This pattern is not fully thread-safe for concurrent requests.
      // The overrideHeadless parameter passed to getOrCreateSession handles the critical
      // browser visibility setting. Future improvement: pass config through function chain.
      const originalConfig = { ...CONFIG };
      const effectiveConfig = applyBrowserOptions(browser_options, show_browser);
      Object.assign(CONFIG, effectiveConfig);

      // Calculate overrideHeadless parameter for session manager
      // show_browser takes precedence over browser_options.headless
      let overrideHeadless: boolean | undefined = undefined;
      if (show_browser !== undefined) {
        overrideHeadless = show_browser;
      } else if (browser_options?.show !== undefined) {
        overrideHeadless = browser_options.show;
      } else if (browser_options?.headless !== undefined) {
        overrideHeadless = !browser_options.headless;
      }

      try {
        // Get or create session (with headless override to handle mode changes)
        const session = await this.sessionManager.getOrCreateSession(
          session_id,
          resolvedNotebookUrl,
          overrideHeadless
        );

        // Progress: Asking question
        await sendProgress?.('Asking question to NotebookLM...', 2, 5);

        // Ask the question with optional source extraction
        const askResult = await session.ask(question, sendProgress, source_format);
        // Note: FOLLOW_UP_REMINDER removed for cleaner responses
        const answer = askResult.answer.trimEnd();

        // Get session info
        const sessionInfo = session.getInfo();

        // Build source citations if extracted
        let sources: SourceCitations | undefined;
        if (askResult.citationResult && source_format !== 'none') {
          sources = {
            format: source_format,
            citations: askResult.citationResult.citations,
            extraction_success: askResult.citationResult.success,
            extraction_error: askResult.citationResult.error,
          };
        }

        const result: AskQuestionSuccess = {
          status: 'success',
          question,
          answer,
          session_id: session.sessionId,
          notebook_url: session.notebookUrl,
          session_info: {
            age_seconds: sessionInfo.age_seconds,
            message_count: sessionInfo.message_count,
            last_activity: sessionInfo.last_activity,
          },
          sources,
        };

        // Progress: Complete
        await sendProgress?.('Question answered successfully!', 5, 5);

        log.success(`✅ [TOOL] ask_question completed successfully`);
        return {
          success: true,
          data: result,
        };
      } finally {
        // Restore original CONFIG
        Object.assign(CONFIG, originalConfig);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Special handling for rate limit errors - try automatic account rotation
      if (
        error instanceof RateLimitError ||
        errorMessage.toLowerCase().includes('rate limit') ||
        errorMessage.toLowerCase().includes('limite quotidienne')
      ) {
        log.warning(`🚫 [TOOL] Rate limit detected - attempting account rotation...`);

        try {
          const accountManager = await getAccountManager();

          // First, identify and mark the current rate-limited account
          const currentAccountId = await accountManager.getCurrentAccountId();
          if (currentAccountId) {
            log.info(`  🚫 Marking current account as rate-limited: ${currentAccountId}`);
            await accountManager.markRateLimited(currentAccountId);
          } else {
            log.warning(
              `  ⚠️ No current account ID stored - marking best available as rate-limited`
            );
            const currentAccount = await accountManager.getBestAccount();
            if (currentAccount?.account) {
              await accountManager.markRateLimited(currentAccount.account.config.id);
            }
          }

          // Now get the next available account (current one is now excluded due to quota)
          const nextAccount = await accountManager.getBestAccount(currentAccountId || undefined);

          if (nextAccount && nextAccount.account) {
            const accountId = nextAccount.account.config.id;
            const email = nextAccount.account.config.email;
            log.info(`  🔄 Switching to account: ${email} (${accountId})`);

            // FIRST: Close all existing sessions AND shared context to release Chrome profile lock
            log.info(`  🛑 Closing sessions and browser context to release profile lock...`);
            await this.sessionManager.closeAllSessions();

            // Wait for Chrome to fully release the profile
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // NOW perform auto-login with the new account (profile is unlocked)
            const autoLogin = new AutoLoginManager(accountManager);
            const loginResult = await autoLogin.performAutoLogin(accountId, { showBrowser: false });

            if (loginResult.success) {
              log.success(`  ✅ Switched to new account successfully`);

              // Sync the new account's profile to the main profile
              await accountManager.syncProfileToMain(accountId);
              await accountManager.saveCurrentAccountId(accountId);

              log.info(`  🔄 Retrying question with new account...`);

              // Retry the question with new account (only once to avoid infinite loops)
              const retryArgs = {
                ...args,
                _retryCount: (((args as Record<string, unknown>)._retryCount as number) || 0) + 1,
              };
              if (retryArgs._retryCount <= 3) {
                return this.handleAskQuestion(retryArgs, sendProgress);
              } else {
                log.warning(`  ⚠️ Max retry count reached (${retryArgs._retryCount})`);
              }
            } else {
              log.error(`  ❌ Failed to switch account: ${loginResult.error}`);
            }
          } else {
            log.warning(`  ⚠️ No other accounts available for rotation`);
          }
        } catch (rotationError) {
          log.error(`  ❌ Account rotation failed: ${rotationError}`);
        }

        // If rotation failed, return the original error
        return {
          success: false,
          error:
            'NotebookLM rate limit reached (50 queries/day for free accounts).\n\n' +
            'Automatic account rotation failed or no other accounts available.\n\n' +
            'You can:\n' +
            "1. Use the 're_auth' tool to login with a different Google account\n" +
            '2. Wait until tomorrow for the quota to reset\n' +
            '3. Upgrade to Google AI Pro/Ultra for 5x higher limits\n\n' +
            `Original error: ${errorMessage}`,
        };
      }

      log.error(`❌ [TOOL] ask_question failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Handle batch_to_vault tool — run N questions and persist each answer
   * as `{slug}.md` + `{slug}.json` in `vault_dir`. Shared logic with the
   * HTTP `/batch-to-vault` endpoint (both call `runBatchToVault`).
   */
  async handleBatchToVault(args: {
    questions: string[];
    vault_dir: string;
    notebook_id?: string;
    notebook_url?: string;
    slug_prefix?: string;
    source_format?: SourceFormat;
    sleep_between_ms?: number;
    session_id?: string;
  }): Promise<ToolResult<BatchToVaultResult>> {
    if (!Array.isArray(args.questions) || args.questions.length === 0) {
      return {
        success: false,
        error: 'questions must be a non-empty string array',
      };
    }
    if (!args.vault_dir || typeof args.vault_dir !== 'string') {
      return {
        success: false,
        error: 'vault_dir is required (absolute or relative directory path)',
      };
    }

    log.info(`🔧 [TOOL] batch_to_vault — ${args.questions.length} questions → ${args.vault_dir}`);
    try {
      const data = await runBatchToVault(args, (askArgs) => this.handleAskQuestion(askArgs), {
        info: (m) => log.info(`  ${m}`),
        error: (m) => log.error(`  ${m}`),
      });
      log.success(
        `✅ batch_to_vault — ${data.succeeded}/${data.total} written to ${data.vault_dir}`
      );
      return { success: true, data };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`❌ batch_to_vault — ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Handle list_sessions tool
   */
  async handleListSessions(): Promise<
    ToolResult<{
      active_sessions: number;
      max_sessions: number;
      session_timeout: number;
      oldest_session_seconds: number;
      total_messages: number;
      sessions: Array<{
        id: string;
        created_at: number;
        last_activity: number;
        age_seconds: number;
        inactive_seconds: number;
        message_count: number;
        notebook_url: string;
      }>;
    }>
  > {
    log.info(`🔧 [TOOL] list_sessions called`);

    try {
      const stats = this.sessionManager.getStats();
      const sessions = this.sessionManager.getAllSessionsInfo();

      const result = {
        active_sessions: stats.active_sessions,
        max_sessions: stats.max_sessions,
        session_timeout: stats.session_timeout,
        oldest_session_seconds: stats.oldest_session_seconds,
        total_messages: stats.total_messages,
        sessions: sessions.map((info) => ({
          id: info.id,
          created_at: info.created_at,
          last_activity: info.last_activity,
          age_seconds: info.age_seconds,
          inactive_seconds: info.inactive_seconds,
          message_count: info.message_count,
          notebook_url: info.notebook_url,
        })),
      };

      log.success(`✅ [TOOL] list_sessions completed (${result.active_sessions} sessions)`);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`❌ [TOOL] list_sessions failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Handle close_session tool
   */
  async handleCloseSession(args: {
    session_id: string;
  }): Promise<ToolResult<{ status: string; message: string; session_id: string }>> {
    const { session_id } = args;

    log.info(`🔧 [TOOL] close_session called`);
    log.info(`  Session ID: ${session_id}`);

    try {
      const closed = await this.sessionManager.closeSession(session_id);

      if (closed) {
        log.success(`✅ [TOOL] close_session completed`);
        return {
          success: true,
          data: {
            status: 'success',
            message: `Session ${session_id} closed successfully`,
            session_id,
          },
        };
      } else {
        log.warning(`⚠️  [TOOL] Session ${session_id} not found`);
        return {
          success: false,
          error: `Session ${session_id} not found`,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`❌ [TOOL] close_session failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Handle reset_session tool
   */
  async handleResetSession(args: {
    session_id: string;
  }): Promise<ToolResult<{ status: string; message: string; session_id: string }>> {
    const { session_id } = args;

    log.info(`🔧 [TOOL] reset_session called`);
    log.info(`  Session ID: ${session_id}`);

    try {
      const session = this.sessionManager.getSession(session_id);

      if (!session) {
        log.warning(`⚠️  [TOOL] Session ${session_id} not found`);
        return {
          success: false,
          error: `Session ${session_id} not found`,
        };
      }

      await session.reset();

      log.success(`✅ [TOOL] reset_session completed`);
      return {
        success: true,
        data: {
          status: 'success',
          message: `Session ${session_id} reset successfully`,
          session_id,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`❌ [TOOL] reset_session failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Handle get_health tool
   */
  async handleGetHealth(): Promise<
    ToolResult<{
      status: string;
      authenticated: boolean;
      notebook_url: string;
      active_sessions: number;
      max_sessions: number;
      session_timeout: number;
      total_messages: number;
      headless: boolean;
      auto_login_enabled: boolean;
      stealth_enabled: boolean;
      troubleshooting_tip?: string;
      current_account?: string;
    }>
  > {
    log.info(`🔧 [TOOL] get_health called`);

    try {
      // Check authentication status using account-specific state file
      let authenticated = false;
      let currentAccountEmail: string | undefined;

      let accountCheckDone = false;
      try {
        const accountManager = await getAccountManager();
        const currentAccountId = await accountManager.getCurrentAccountId();

        if (currentAccountId) {
          const account = accountManager.getAccount(currentAccountId);
          if (account) {
            currentAccountEmail = account.config.email;
            accountCheckDone = true; // Mark that we found an account
            // Check account-specific state file
            if (fs.existsSync(account.stateFilePath)) {
              try {
                const stateData = fs.readFileSync(account.stateFilePath, 'utf-8');
                const state = JSON.parse(stateData);
                if (state.cookies && state.cookies.length > 0) {
                  // Check for critical auth cookies
                  const criticalCookieNames = ['SID', 'HSID', 'SSID', 'APISID', 'SAPISID'];
                  const criticalCookies = state.cookies.filter((c: { name: string }) =>
                    criticalCookieNames.includes(c.name)
                  );
                  if (criticalCookies.length > 0) {
                    // Check expiration
                    const currentTime = Date.now() / 1000;
                    const hasExpired = criticalCookies.some((c: { expires?: number }) => {
                      const expires = c.expires ?? -1;
                      return expires !== -1 && expires < currentTime;
                    });
                    authenticated = !hasExpired;
                  }
                }
              } catch {
                // Invalid state file
              }
            }
          }
        }
      } catch {
        // AccountManager failed, will use fallback
      }

      // Fall back to legacy global AuthManager path if no account was found
      if (!accountCheckDone) {
        const statePath = await this.authManager.getValidStatePath();
        authenticated = statePath !== null;
      }

      // Get session stats
      const stats = this.sessionManager.getStats();

      const result = {
        status: 'ok',
        authenticated,
        notebook_url: CONFIG.notebookUrl || 'not configured',
        active_sessions: stats.active_sessions,
        max_sessions: stats.max_sessions,
        session_timeout: stats.session_timeout,
        total_messages: stats.total_messages,
        headless: CONFIG.headless,
        auto_login_enabled: CONFIG.autoLoginEnabled,
        stealth_enabled: CONFIG.stealthEnabled,
        // Include current account if available
        ...(currentAccountEmail && { current_account: currentAccountEmail }),
        // Add troubleshooting tip if not authenticated
        ...(!authenticated && {
          troubleshooting_tip:
            'For fresh start with clean browser session: Close all Chrome instances → ' +
            'cleanup_data(confirm=true, preserve_library=true) → setup_auth',
        }),
      };

      log.success(`✅ [TOOL] get_health completed`);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`❌ [TOOL] get_health failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Handle setup_auth tool
   *
   * Opens a browser window for manual login with live progress updates.
   * The operation waits synchronously for login completion (up to 10 minutes).
   */
  async handleSetupAuth(
    args: {
      show_browser?: boolean;
      browser_options?: BrowserOptions;
    },
    sendProgress?: ProgressCallback
  ): Promise<
    ToolResult<{
      status: string;
      message: string;
      authenticated: boolean;
      duration_seconds?: number;
    }>
  > {
    const { show_browser, browser_options } = args;

    // CRITICAL: Send immediate progress to reset timeout from the very start
    await sendProgress?.('Initializing authentication setup...', 0, 10);

    log.info(`🔧 [TOOL] setup_auth called`);
    if (show_browser !== undefined) {
      log.info(`  Show browser: ${show_browser}`);
    }

    const startTime = Date.now();

    // Apply browser options temporarily
    const originalConfig = { ...CONFIG };
    const effectiveConfig = applyBrowserOptions(browser_options, show_browser);
    Object.assign(CONFIG, effectiveConfig);

    try {
      // Progress: Starting
      await sendProgress?.('Preparing authentication browser...', 1, 10);

      log.info(`  🌐 Opening browser for interactive login...`);

      // Progress: Opening browser
      await sendProgress?.('Opening browser window...', 2, 10);

      // Perform setup with progress updates
      // Pass show_browser to control headless mode (false = headless, true = visible)
      const success = await this.authManager.performSetup(sendProgress, show_browser);

      const durationSeconds = (Date.now() - startTime) / 1000;

      if (success) {
        // Progress: Complete
        await sendProgress?.('Authentication saved successfully!', 10, 10);

        log.success(`✅ [TOOL] setup_auth completed (${durationSeconds.toFixed(1)}s)`);
        return {
          success: true,
          data: {
            status: 'authenticated',
            message: 'Successfully authenticated and saved browser state',
            authenticated: true,
            duration_seconds: durationSeconds,
          },
        };
      } else {
        log.error(`❌ [TOOL] setup_auth failed (${durationSeconds.toFixed(1)}s)`);
        return {
          success: false,
          error: 'Authentication failed or was cancelled',
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const durationSeconds = (Date.now() - startTime) / 1000;
      log.error(`❌ [TOOL] setup_auth failed: ${errorMessage} (${durationSeconds.toFixed(1)}s)`);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      // Restore original CONFIG
      Object.assign(CONFIG, originalConfig);
    }
  }

  /**
   * Handle de_auth tool
   *
   * De-authenticates (logout) by clearing all authentication data.
   * This preserves the notebook library but removes all credentials.
   *
   * Steps:
   * 1. Closes all active browser sessions
   * 2. Deletes all saved authentication data (cookies, Chrome profile)
   *
   * Use for security logout or clearing credentials without re-authenticating.
   */
  async handleDeAuth(): Promise<
    ToolResult<{
      status: string;
      message: string;
      authenticated: boolean;
    }>
  > {
    log.info(`🔧 [TOOL] de_auth called`);

    try {
      // 1. Close all active sessions
      log.info('  🛑 Closing all sessions...');
      await this.sessionManager.closeAllSessions();
      log.success('  ✅ All sessions closed');

      // 2. Clear all auth data
      log.info('  🗑️  Clearing all authentication data...');
      await this.authManager.clearAllAuthData();
      log.success('  ✅ Authentication data cleared');

      log.success(`✅ [TOOL] de_auth completed - Successfully logged out`);
      return {
        success: true,
        data: {
          status: 'de-authenticated',
          message: 'Successfully logged out. Use setup_auth or re_auth to authenticate again.',
          authenticated: false,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`❌ [TOOL] de_auth failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Handle re_auth tool
   *
   * Performs a complete re-authentication:
   * 1. De-authenticates (calls de_auth internally)
   * 2. Opens browser for fresh Google login
   *
   * Use for switching Google accounts or recovering from rate limits.
   */
  async handleReAuth(
    args: {
      show_browser?: boolean;
      browser_options?: BrowserOptions;
    },
    sendProgress?: ProgressCallback
  ): Promise<
    ToolResult<{
      status: string;
      message: string;
      authenticated: boolean;
      duration_seconds?: number;
    }>
  > {
    const { show_browser, browser_options } = args;

    await sendProgress?.('Preparing re-authentication...', 0, 12);
    log.info(`🔧 [TOOL] re_auth called`);
    if (show_browser !== undefined) {
      log.info(`  Show browser: ${show_browser}`);
    }

    const startTime = Date.now();

    // Apply browser options temporarily
    const originalConfig = { ...CONFIG };
    const effectiveConfig = applyBrowserOptions(browser_options, show_browser);
    Object.assign(CONFIG, effectiveConfig);

    try {
      // 1. De-authenticate first (logout)
      await sendProgress?.('De-authenticating...', 1, 12);
      log.info('  🔓 De-authenticating (logout)...');
      const deAuthResult = await this.handleDeAuth();
      if (!deAuthResult.success) {
        throw new Error(`De-authentication failed: ${deAuthResult.error}`);
      }
      log.success('  ✅ De-authentication complete');

      // 2. Perform fresh setup
      await sendProgress?.('Starting fresh authentication...', 3, 12);
      log.info('  🌐 Starting fresh authentication setup...');
      const success = await this.authManager.performSetup(sendProgress);

      const durationSeconds = (Date.now() - startTime) / 1000;

      if (success) {
        // Clear stale current-account marker. re_auth may have logged in with a
        // different Google account, but performSetup() (manual browser login)
        // doesn't tell us which account the user picked. Rather than keep
        // returning the previous email from get_health, drop the marker so
        // get_health truthfully omits `current_account`.
        try {
          const accountManager = await getAccountManager();
          await accountManager.clearCurrentAccountId();
        } catch (e) {
          log.warning(`  ⚠️ Could not clear current account marker: ${e}`);
        }

        await sendProgress?.('Re-authentication complete!', 12, 12);
        log.success(`✅ [TOOL] re_auth completed (${durationSeconds.toFixed(1)}s)`);
        return {
          success: true,
          data: {
            status: 'authenticated',
            message:
              'Successfully re-authenticated with new account. All previous sessions have been closed.',
            authenticated: true,
            duration_seconds: durationSeconds,
          },
        };
      } else {
        log.error(`❌ [TOOL] re_auth failed (${durationSeconds.toFixed(1)}s)`);
        return {
          success: false,
          error: 'Re-authentication failed or was cancelled',
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const durationSeconds = (Date.now() - startTime) / 1000;
      log.error(`❌ [TOOL] re_auth failed: ${errorMessage} (${durationSeconds.toFixed(1)}s)`);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      // Restore original CONFIG
      Object.assign(CONFIG, originalConfig);
    }
  }

  /**
   * Handle auto_discover_notebook tool
   */
  async handleAutoDiscoverNotebook(args: {
    url: string;
  }): Promise<ToolResult<{ notebook: NotebookEntry }>> {
    log.info(`🔧 [TOOL] auto_discover_notebook called`);
    log.info(`  URL: ${args.url}`);

    try {
      // Import auto-discovery module
      const { AutoDiscovery } = await import('../auto-discovery/auto-discovery.js');

      // Create AutoDiscovery instance and discover metadata
      log.info(`  🤖 Querying NotebookLM for auto-generated metadata...`);
      const autoDiscovery = new AutoDiscovery(this.sessionManager);
      const metadata = await autoDiscovery.discoverMetadata(args.url);

      // Prepare notebook input
      const notebookInput = {
        url: args.url,
        name: metadata.name,
        description: metadata.description,
        topics: metadata.tags, // tags → topics
        content_types: ['documentation'],
        use_cases: metadata.tags.slice(0, 3), // Use first 3 tags as use cases
        auto_generated: true,
      };

      // Add notebook to library
      const notebook = await this.library.addNotebook(notebookInput);

      log.success(`✅ [TOOL] auto_discover_notebook completed: ${notebook.id}`);
      log.info(`  Generated metadata:`);
      log.info(`    Name: ${metadata.name}`);
      log.info(`    Description: ${metadata.description.substring(0, 100)}...`);
      log.info(`    Tags: ${metadata.tags.join(', ')}`);

      return {
        success: true,
        data: { notebook },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`❌ [TOOL] auto_discover_notebook failed: ${errorMessage}`);
      return {
        success: false,
        error: `Auto-discovery failed: ${errorMessage}. Try using add_notebook for manual entry instead.`,
      };
    }
  }

  /**
   * Handle add_notebook tool
   */
  async handleAddNotebook(
    args: AddNotebookInput
  ): Promise<ToolResult<{ notebook: NotebookEntry }>> {
    log.info(`🔧 [TOOL] add_notebook called`);
    log.info(`  Name: ${args.name}`);

    try {
      const notebook = await this.library.addNotebook(args);
      log.success(`✅ [TOOL] add_notebook completed: ${notebook.id}`);
      return {
        success: true,
        data: { notebook },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`❌ [TOOL] add_notebook failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Handle list_notebooks tool
   */
  async handleListNotebooks(): Promise<
    ToolResult<{ notebooks: NotebookEntry[]; active_notebook_id: string | null }>
  > {
    log.info(`🔧 [TOOL] list_notebooks called`);

    try {
      const notebooks = this.library.listNotebooks();
      const activeNotebook = this.library.getActiveNotebook();
      const active_notebook_id = activeNotebook ? activeNotebook.id : null;

      log.success(
        `✅ [TOOL] list_notebooks completed (${notebooks.length} notebooks, active: ${active_notebook_id || 'none'})`
      );
      return {
        success: true,
        data: {
          notebooks,
          active_notebook_id,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`❌ [TOOL] list_notebooks failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Handle get_notebook tool
   */
  async handleGetNotebook(args: { id: string }): Promise<ToolResult<{ notebook: NotebookEntry }>> {
    log.info(`🔧 [TOOL] get_notebook called`);
    log.info(`  ID: ${args.id}`);

    try {
      const notebook = this.library.getNotebook(args.id);
      if (!notebook) {
        log.warning(`⚠️  [TOOL] Notebook not found: ${args.id}`);
        return {
          success: false,
          error: `Notebook not found: ${args.id}`,
        };
      }

      log.success(`✅ [TOOL] get_notebook completed: ${notebook.name}`);
      return {
        success: true,
        data: { notebook },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`❌ [TOOL] get_notebook failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Handle select_notebook tool
   */
  async handleSelectNotebook(args: {
    id: string;
  }): Promise<ToolResult<{ notebook: NotebookEntry }>> {
    log.info(`🔧 [TOOL] select_notebook called`);
    log.info(`  ID: ${args.id}`);

    try {
      const notebook = this.library.selectNotebook(args.id);
      log.success(`✅ [TOOL] select_notebook completed: ${notebook.name}`);
      return {
        success: true,
        data: { notebook },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`❌ [TOOL] select_notebook failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Handle update_notebook tool
   */
  async handleUpdateNotebook(
    args: UpdateNotebookInput
  ): Promise<ToolResult<{ notebook: NotebookEntry }>> {
    log.info(`🔧 [TOOL] update_notebook called`);
    log.info(`  ID: ${args.id}`);

    try {
      const notebook = this.library.updateNotebook(args);
      log.success(`✅ [TOOL] update_notebook completed: ${notebook.name}`);
      return {
        success: true,
        data: { notebook },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`❌ [TOOL] update_notebook failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Handle remove_notebook tool
   */
  async handleRemoveNotebook(args: {
    id: string;
  }): Promise<ToolResult<{ removed: boolean; closed_sessions: number }>> {
    log.info(`🔧 [TOOL] remove_notebook called`);
    log.info(`  ID: ${args.id}`);

    try {
      const notebook = this.library.getNotebook(args.id);
      if (!notebook) {
        log.warning(`⚠️  [TOOL] Notebook not found: ${args.id}`);
        return {
          success: false,
          error: `Notebook not found: ${args.id}`,
        };
      }

      const removed = this.library.removeNotebook(args.id);
      if (removed) {
        const closedSessions = await this.sessionManager.closeSessionsForNotebook(notebook.url);
        log.success(`✅ [TOOL] remove_notebook completed`);
        return {
          success: true,
          data: { removed: true, closed_sessions: closedSessions },
        };
      } else {
        log.warning(`⚠️  [TOOL] Notebook not found: ${args.id}`);
        return {
          success: false,
          error: `Notebook not found: ${args.id}`,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`❌ [TOOL] remove_notebook failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Handle search_notebooks tool
   */
  async handleSearchNotebooks(args: {
    query: string;
  }): Promise<ToolResult<{ notebooks: NotebookEntry[] }>> {
    log.info(`🔧 [TOOL] search_notebooks called`);
    log.info(`  Query: "${args.query}"`);

    try {
      const notebooks = this.library.searchNotebooks(args.query);
      log.success(`✅ [TOOL] search_notebooks completed (${notebooks.length} results)`);
      return {
        success: true,
        data: { notebooks },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`❌ [TOOL] search_notebooks failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Handle get_library_stats tool
   */
  async handleGetLibraryStats(): Promise<ToolResult<LibraryStats>> {
    log.info(`🔧 [TOOL] get_library_stats called`);

    try {
      const stats = this.library.getStats();
      log.success(`✅ [TOOL] get_library_stats completed`);
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`❌ [TOOL] get_library_stats failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Handle cleanup_data tool
   *
   * ULTRATHINK Deep Cleanup - scans entire system for ALL NotebookLM MCP files
   */
  async handleCleanupData(args: { confirm: boolean; preserve_library?: boolean }): Promise<
    ToolResult<{
      status: string;
      mode: string;
      preview?: {
        categories: Array<{
          name: string;
          description: string;
          paths: string[];
          totalBytes: number;
          optional: boolean;
        }>;
        totalPaths: number;
        totalSizeBytes: number;
      };
      result?: {
        deletedPaths: string[];
        failedPaths: string[];
        totalSizeBytes: number;
        categorySummary: Record<string, { count: number; bytes: number }>;
      };
    }>
  > {
    const { confirm, preserve_library = false } = args;

    log.info(`🔧 [TOOL] cleanup_data called`);
    log.info(`  Confirm: ${confirm}`);
    log.info(`  Preserve Library: ${preserve_library}`);

    const cleanupManager = new CleanupManager();

    try {
      // Always run in deep mode
      const mode = 'deep';

      if (!confirm) {
        // Preview mode - show what would be deleted
        log.info(`  📋 Generating cleanup preview (mode: ${mode})...`);

        const preview = await cleanupManager.getCleanupPaths(mode, preserve_library);
        const platformInfo = cleanupManager.getPlatformInfo();

        log.info(
          `  Found ${preview.totalPaths.length} items (${cleanupManager.formatBytes(preview.totalSizeBytes)})`
        );
        log.info(`  Platform: ${platformInfo.platform}`);

        return {
          success: true,
          data: {
            status: 'preview',
            mode,
            preview: {
              categories: preview.categories,
              totalPaths: preview.totalPaths.length,
              totalSizeBytes: preview.totalSizeBytes,
            },
          },
        };
      } else {
        // Cleanup mode - actually delete files
        log.info(`  🗑️  Performing cleanup (mode: ${mode})...`);

        const result = await cleanupManager.performCleanup(mode, preserve_library);

        if (result.success) {
          log.success(
            `✅ [TOOL] cleanup_data completed - deleted ${result.deletedPaths.length} items`
          );
        } else {
          log.warning(`⚠️  [TOOL] cleanup_data completed with ${result.failedPaths.length} errors`);
        }

        return {
          success: result.success,
          data: {
            status: result.success ? 'completed' : 'partial',
            mode,
            result: {
              deletedPaths: result.deletedPaths,
              failedPaths: result.failedPaths,
              totalSizeBytes: result.totalSizeBytes,
              categorySummary: result.categorySummary,
            },
          },
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`❌ [TOOL] cleanup_data failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // ============================================================================
  // Content Management Handlers
  // ============================================================================

  /**
   * Handle add_source tool
   */
  async handleAddSource(args: {
    source_type: SourceType;
    file_path?: string;
    url?: string;
    text?: string;
    title?: string;
    notebook_url?: string;
    session_id?: string;
    show_browser?: boolean;
  }): Promise<ToolResult<SourceUploadResult>> {
    const { source_type, file_path, url, text, title, notebook_url, session_id, show_browser } =
      args;

    log.info(`🔧 [TOOL] add_source called`);
    log.info(`  Source type: ${source_type}`);

    // Apply show_browser option
    // show_browser=true → overrideHeadless=false (visible browser)
    // show_browser=false → overrideHeadless=true (headless)
    // show_browser=undefined → overrideHeadless=undefined (use config default)
    const overrideHeadless = show_browser !== undefined ? !show_browser : undefined;

    try {
      // Resolve notebook URL
      const resolvedNotebookUrl =
        notebook_url || this.library.getActiveNotebook()?.url || CONFIG.notebookUrl;
      if (!resolvedNotebookUrl) {
        return {
          success: false,
          error: 'No notebook URL provided and no active notebook set',
        };
      }

      // Get or create session
      const session = await this.sessionManager.getOrCreateSession(
        session_id,
        resolvedNotebookUrl,
        overrideHeadless
      );
      const page = session.getPage();

      if (!page) {
        return {
          success: false,
          error: 'Could not access browser page - session may not be initialized',
        };
      }

      // Create content manager
      const contentManager = new ContentManager(page);

      // Add source
      const result = await contentManager.addSource({
        type: source_type,
        filePath: file_path,
        url,
        text,
        title,
      });

      if (result.success) {
        log.success(`✅ [TOOL] add_source completed`);
      } else {
        log.error(`❌ [TOOL] add_source failed: ${result.error}`);
      }

      return {
        success: result.success,
        data: result,
        error: result.error,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`❌ [TOOL] add_source failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Handle delete_source tool
   */
  async handleDeleteSource(args: {
    source_id?: string;
    source_name?: string;
    notebook_url?: string;
    session_id?: string;
  }): Promise<ToolResult<SourceDeleteResult>> {
    const { source_id, source_name, notebook_url, session_id } = args;

    log.info(`🔧 [TOOL] delete_source called`);
    if (source_id) {
      log.info(`  Source ID: ${source_id}`);
    }
    if (source_name) {
      log.info(`  Source name: ${source_name}`);
    }

    // Validate that at least one identifier is provided
    if (!source_id && !source_name) {
      return {
        success: false,
        error: 'Either source_id or source_name is required to identify the source to delete',
      };
    }

    try {
      // Resolve notebook URL
      const resolvedNotebookUrl =
        notebook_url || this.library.getActiveNotebook()?.url || CONFIG.notebookUrl;
      if (!resolvedNotebookUrl) {
        return {
          success: false,
          error: 'No notebook URL provided and no active notebook set',
        };
      }

      // Get or create session
      const session = await this.sessionManager.getOrCreateSession(session_id, resolvedNotebookUrl);
      const page = session.getPage();

      if (!page) {
        return {
          success: false,
          error: 'Could not access browser page - session may not be initialized',
        };
      }

      // Create content manager
      const contentManager = new ContentManager(page);

      // Delete source
      const result = await contentManager.deleteSource({
        sourceId: source_id,
        sourceName: source_name,
      });

      if (result.success) {
        log.success(`✅ [TOOL] delete_source completed: ${result.sourceName || result.sourceId}`);
      } else {
        log.error(`❌ [TOOL] delete_source failed: ${result.error}`);
      }

      return {
        success: result.success,
        data: result,
        error: result.error,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`❌ [TOOL] delete_source failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Handle generate_content tool
   */
  async handleGenerateContent(args: {
    content_type: ContentType;
    custom_instructions?: string;
    notebook_url?: string;
    session_id?: string;
    language?: string;
    video_style?: VideoStyle;
    video_format?: VideoFormat;
    infographic_format?: InfographicFormat;
    report_format?: ReportFormat;
    presentation_style?: PresentationStyle;
    presentation_length?: PresentationLength;
  }): Promise<ToolResult<ContentGenerationResult>> {
    const {
      content_type,
      custom_instructions,
      notebook_url,
      session_id,
      language,
      video_style,
      video_format,
      infographic_format,
      report_format,
      presentation_style,
      presentation_length,
    } = args;

    log.info(`🔧 [TOOL] generate_content called`);
    log.info(`  Content type: ${content_type}`);
    if (language) {
      log.info(`  Language: ${language}`);
    }
    if (video_style) {
      log.info(`  Video style: ${video_style}`);
    }
    if (video_format) {
      log.info(`  Video format: ${video_format}`);
    }

    try {
      // Resolve notebook URL
      const resolvedNotebookUrl =
        notebook_url || this.library.getActiveNotebook()?.url || CONFIG.notebookUrl;
      if (!resolvedNotebookUrl) {
        return {
          success: false,
          error: 'No notebook URL provided and no active notebook set',
        };
      }

      // Get or create session
      const session = await this.sessionManager.getOrCreateSession(session_id, resolvedNotebookUrl);
      const page = session.getPage();

      if (!page) {
        return {
          success: false,
          error: 'Could not access browser page',
        };
      }

      // Create content manager
      const contentManager = new ContentManager(page);

      // Generate content with all options
      const result = await contentManager.generateContent({
        type: content_type,
        customInstructions: custom_instructions,
        language,
        videoStyle: video_style,
        videoFormat: video_format,
        infographicFormat: infographic_format,
        reportFormat: report_format,
        presentationStyle: presentation_style,
        presentationLength: presentation_length,
      });

      if (result.success) {
        log.success(`✅ [TOOL] generate_content completed`);
      } else {
        log.error(`❌ [TOOL] generate_content failed: ${result.error}`);
      }

      return {
        success: result.success,
        data: result,
        error: result.error,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`❌ [TOOL] generate_content failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Handle list_content tool
   */
  async handleListContent(args: {
    notebook_url?: string;
    session_id?: string;
  }): Promise<ToolResult<NotebookContentOverview>> {
    const { notebook_url, session_id } = args;

    log.info(`🔧 [TOOL] list_content called`);

    try {
      // Resolve notebook URL
      const resolvedNotebookUrl =
        notebook_url || this.library.getActiveNotebook()?.url || CONFIG.notebookUrl;
      if (!resolvedNotebookUrl) {
        return {
          success: false,
          error: 'No notebook URL provided and no active notebook set',
        };
      }

      // Get or create session
      const session = await this.sessionManager.getOrCreateSession(session_id, resolvedNotebookUrl);
      const page = session.getPage();

      if (!page) {
        return {
          success: false,
          error: 'Could not access browser page',
        };
      }

      // Create content manager
      const contentManager = new ContentManager(page);

      // Get content overview
      const result = await contentManager.getContentOverview();

      log.success(`✅ [TOOL] list_content completed (${result.sourceCount} sources)`);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`❌ [TOOL] list_content failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Handle download_content tool (generic download for audio, video, infographic)
   */
  async handleDownloadContent(args: {
    content_type: ContentType;
    output_path?: string;
    notebook_url?: string;
    session_id?: string;
  }): Promise<ToolResult<ContentDownloadResult>> {
    const { content_type, output_path, notebook_url, session_id } = args;

    log.info(`🔧 [TOOL] download_content called`);
    log.info(`  Content type: ${content_type}`);

    try {
      // Resolve notebook URL
      const resolvedNotebookUrl =
        notebook_url || this.library.getActiveNotebook()?.url || CONFIG.notebookUrl;
      if (!resolvedNotebookUrl) {
        return {
          success: false,
          error: 'No notebook URL provided and no active notebook set',
        };
      }

      // Get or create session
      const session = await this.sessionManager.getOrCreateSession(session_id, resolvedNotebookUrl);
      const page = session.getPage();

      if (!page) {
        return {
          success: false,
          error: 'Could not access browser page',
        };
      }

      // Create content manager
      const contentManager = new ContentManager(page);

      // Download/export content
      const result = await contentManager.downloadContent(content_type, output_path);

      if (result.success) {
        // Log appropriate message based on export type
        if (result.googleSlidesUrl) {
          log.success(`✅ [TOOL] download_content completed: Google Slides URL exported`);
        } else if (result.googleSheetsUrl) {
          log.success(`✅ [TOOL] download_content completed: Google Sheets URL exported`);
        } else if (result.filePath) {
          log.success(`✅ [TOOL] download_content completed: ${result.filePath}`);
        } else {
          log.success(`✅ [TOOL] download_content completed`);
        }
      } else {
        log.error(`❌ [TOOL] download_content failed: ${result.error}`);
      }

      return {
        success: result.success,
        data: result,
        error: result.error,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`❌ [TOOL] download_content failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Handle create_note tool
   *
   * Creates a note in the NotebookLM Studio panel with the specified title and content.
   */
  async handleCreateNote(args: {
    title: string;
    content: string;
    notebook_url?: string;
    session_id?: string;
  }): Promise<ToolResult<NoteResult>> {
    const { title, content, notebook_url, session_id } = args;

    log.info(`🔧 [TOOL] create_note called`);
    log.info(`  Title: "${title}"`);
    log.info(`  Content length: ${content.length} chars`);

    try {
      // Validate required fields
      if (!title || title.trim().length === 0) {
        return {
          success: false,
          error: 'Note title is required',
        };
      }

      if (!content || content.trim().length === 0) {
        return {
          success: false,
          error: 'Note content is required',
        };
      }

      // Resolve notebook URL
      const resolvedNotebookUrl =
        notebook_url || this.library.getActiveNotebook()?.url || CONFIG.notebookUrl;
      if (!resolvedNotebookUrl) {
        return {
          success: false,
          error: 'No notebook URL provided and no active notebook set',
        };
      }

      // Get or create session
      const session = await this.sessionManager.getOrCreateSession(session_id, resolvedNotebookUrl);
      const page = session.getPage();

      if (!page) {
        return {
          success: false,
          error: 'Could not access browser page',
        };
      }

      // Create content manager
      const contentManager = new ContentManager(page);

      // Create the note
      const result = await contentManager.createNote({
        title: title.trim(),
        content: content.trim(),
      });

      if (result.success) {
        log.success(`✅ [TOOL] create_note completed: "${title}"`);
      } else {
        log.error(`❌ [TOOL] create_note failed: ${result.error}`);
      }

      return {
        success: result.success,
        data: result,
        error: result.error,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`❌ [TOOL] create_note failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Handle save_chat_to_note tool
   *
   * Extracts chat messages from the Discussion panel and saves them as a note.
   */
  async handleSaveChatToNote(args: {
    title?: string;
    notebook_url?: string;
    session_id?: string;
  }): Promise<ToolResult<SaveChatToNoteResult>> {
    const { title, notebook_url, session_id } = args;

    log.info(`🔧 [TOOL] save_chat_to_note called`);
    if (title) {
      log.info(`  Title: "${title}"`);
    }

    try {
      // Resolve notebook URL
      const resolvedNotebookUrl =
        notebook_url || this.library.getActiveNotebook()?.url || CONFIG.notebookUrl;
      if (!resolvedNotebookUrl) {
        return {
          success: false,
          error: 'No notebook URL provided and no active notebook set',
        };
      }

      // Get or create session
      const session = await this.sessionManager.getOrCreateSession(session_id, resolvedNotebookUrl);
      const page = session.getPage();

      if (!page) {
        return {
          success: false,
          error: 'Could not access browser page',
        };
      }

      // Create content manager
      const contentManager = new ContentManager(page);

      // Save chat to note
      const result = await contentManager.saveChatToNote({
        title,
      });

      if (result.success) {
        log.success(
          `✅ [TOOL] save_chat_to_note completed: "${result.noteTitle}" (${result.messageCount} messages)`
        );
      } else {
        log.error(`❌ [TOOL] save_chat_to_note failed: ${result.error}`);
      }

      return {
        success: result.success,
        data: result,
        error: result.error,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`❌ [TOOL] save_chat_to_note failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Handle convert_note_to_source tool
   *
   * Converts an existing note to a source document in NotebookLM.
   * This makes the note content available for RAG queries.
   */
  async handleConvertNoteToSource(args: {
    note_title: string;
    notebook_url?: string;
    session_id?: string;
  }): Promise<ToolResult<NoteToSourceResult>> {
    const { note_title, notebook_url, session_id } = args;

    log.info(`🔧 [TOOL] convert_note_to_source called`);
    log.info(`  Note title: "${note_title}"`);

    try {
      // Validate required fields
      if (!note_title || note_title.trim().length === 0) {
        return {
          success: false,
          error: 'Note title is required',
        };
      }

      // Resolve notebook URL
      const resolvedNotebookUrl =
        notebook_url || this.library.getActiveNotebook()?.url || CONFIG.notebookUrl;
      if (!resolvedNotebookUrl) {
        return {
          success: false,
          error: 'No notebook URL provided and no active notebook set',
        };
      }

      // Get or create session
      const session = await this.sessionManager.getOrCreateSession(session_id, resolvedNotebookUrl);
      const page = session.getPage();

      if (!page) {
        return {
          success: false,
          error: 'Could not access browser page',
        };
      }

      // Create content manager
      const contentManager = new ContentManager(page);

      // Convert the note to source
      const result = await contentManager.convertNoteToSource({
        noteTitle: note_title.trim(),
      });

      if (result.success) {
        log.success(
          `✅ [TOOL] convert_note_to_source completed: "${note_title}" -> "${result.sourceName}"`
        );
      } else {
        log.error(`❌ [TOOL] convert_note_to_source failed: ${result.error}`);
      }

      return {
        success: result.success,
        data: result,
        error: result.error,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`❌ [TOOL] convert_note_to_source failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Handle list_notebooks_from_nblm tool
   *
   * Scrapes the NotebookLM homepage to get a real list of all notebooks.
   * This navigates to notebooklm.google.com and extracts notebook info from the page.
   */
  async handleListNotebooksFromNblm(
    args: {
      show_browser?: boolean;
    },
    sendProgress?: ProgressCallback
  ): Promise<
    ToolResult<{
      notebooks: Array<{
        id: string;
        name: string;
        url: string;
      }>;
      total: number;
      message: string;
    }>
  > {
    const { show_browser } = args;

    await sendProgress?.('Scraping notebooks from NotebookLM...', 0, 5);
    log.info(`🔧 [TOOL] list_notebooks_from_nblm called`);

    try {
      // Apply show_browser option
      const originalHeadless = CONFIG.headless;
      if (show_browser !== undefined) {
        CONFIG.headless = !show_browser;
      }

      // Get shared context manager
      const sharedContextManager = this.sessionManager.getSharedContextManager();
      const context = await sharedContextManager.getOrCreateContext();
      const page = await context.newPage();

      try {
        await sendProgress?.('Navigating to NotebookLM homepage...', 1, 5);
        log.info('  📄 Navigating to NotebookLM homepage...');

        // Navigate to NotebookLM homepage
        await page.goto('https://notebooklm.google.com/', {
          waitUntil: 'domcontentloaded',
          timeout: 60000,
        });

        // Wait for the page to fully render and show notebook cards
        // The homepage shows a grid of notebook cards with links
        await sendProgress?.('Waiting for notebooks to load...', 2, 5);
        log.info('  ⏳ Waiting for notebooks to appear...');

        // Wait up to 30 seconds for notebook cards to appear
        // NotebookLM uses buttons with aria-labelledby="project-{UUID}-title"
        try {
          await page.waitForSelector('button[aria-labelledby*="project-"]', { timeout: 30000 });
        } catch {
          log.warning('  ⚠️ No notebook links found after 30s wait');
          // Debug: log current URL and page content
          const currentUrl = page.url();
          log.warning(`  🔍 Debug - Current URL: ${currentUrl}`);

          // Check if we're on a login/redirect page
          if (currentUrl.includes('accounts.google.com') || currentUrl.includes('signin')) {
            log.warning('  ⚠️ Redirected to Google login page - cookies may have expired');
          }

          // Log all links on the page for debugging
          const allLinks = await page.locator('a').all();
          const linkSample = await Promise.all(
            allLinks.slice(0, 10).map(async (l) => {
              const href = await l.getAttribute('href');
              const text = await l.textContent();
              return `${href}: ${text?.substring(0, 50)}`;
            })
          );
          log.warning(`  📋 First 10 links on page:\n    ${linkSample.join('\n    ')}`);

          // Look for any elements that might contain notebook cards (divs, buttons, etc.)
          const title = await page.title();
          log.warning(`  📄 Page title: ${title}`);

          // Check for elements with notebook-related data or classes
          const notebookElements = await page
            .locator(
              '[data-id], [data-notebook-id], [class*="notebook"], [class*="card"], [role="listitem"]'
            )
            .all();
          log.warning(
            `  🔍 Found ${notebookElements.length} potential notebook elements (cards/divs)`
          );

          // Get page content to look for notebook patterns
          const bodyContent = await page.content();
          const notebookMatches = bodyContent.match(/notebook\/[a-f0-9-]+/g);
          log.warning(
            `  🔍 Notebook IDs in HTML: ${notebookMatches?.slice(0, 5).join(', ') || 'None found'}`
          );

          // Take screenshot for debugging
          await page.screenshot({ path: 'debug-homepage.png', fullPage: true });
          log.warning('  📸 Screenshot saved to debug-homepage.png');
        }
        await randomDelay(2000, 3000);

        await sendProgress?.('Extracting notebook list...', 3, 5);
        log.info('  🔍 Looking for notebook cards...');

        const notebooks: Array<{ id: string; name: string; url: string }> = [];
        const seenIds = new Set<string>();

        // Strategy 1: Single page.evaluate() that walks every element whose
        // id matches `project-{UUID}-title` and reads its textContent.
        //
        // This sidesteps the older `button[aria-labelledby*="project-"]`
        // selector (NotebookLM has changed which tag wraps the title — a
        // <button> with aria-labelledby today, something else tomorrow).
        // The id-based naming is stable: NotebookLM consistently identifies
        // each notebook by `project-{UUID}-title` regardless of layout.
        //
        // Passed as a template string so we don't fight tsconfig's missing
        // DOM lib (consistent with the rest of the codebase, e.g. browser-session.ts).
        type ScrapedNotebook = { id: string; name: string };
        const scraped = (await page.evaluate(`
          (() => {
            const out = [];
            const els = document.querySelectorAll('[id^="project-"][id$="-title"]');
            els.forEach((el) => {
              const m = el.id.match(/^project-([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})-title$/);
              if (!m) return;
              const text = (el.textContent ?? '').trim();
              if (text) out.push({ id: m[1], name: text });
            });
            return out;
          })()
        `)) as ScrapedNotebook[];
        log.info(`  📋 Strategy 1 found ${scraped.length} notebook titles via id-based scan`);

        for (const { id, name } of scraped) {
          if (seenIds.has(id)) continue;
          seenIds.add(id);
          const url = `https://notebooklm.google.com/notebook/${id}`;
          notebooks.push({ id, name, url });
          log.info(`    📓 Found: ${name} (${id.substring(0, 8)}...)`);
        }

        // Strategy 2: Fallback for edge cases where the title element is
        // present in the DOM tree but its textContent is empty (e.g. a
        // notebook that hasn't finished hydrating). We discover any
        // additional UUIDs from the raw HTML so the caller at least sees
        // the notebook id, and mark `name` as empty (NOT a hardcoded
        // "Notebook" placeholder — that was the old bug).
        const pageContent = await page.content();
        const allUuidMatches = pageContent.match(
          /project-([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/g
        );
        if (allUuidMatches) {
          for (const match of allUuidMatches) {
            const id = match.replace('project-', '');
            if (seenIds.has(id)) continue;
            seenIds.add(id);
            const url = `https://notebooklm.google.com/notebook/${id}`;
            notebooks.push({ id, name: '', url });
            log.warning(
              `    📓 Found id only (no title hydrated): ${id.substring(0, 8)}... (name empty, not "Notebook")`
            );
          }
        }

        await sendProgress?.('Done!', 5, 5);
        log.success(`  ✅ Found ${notebooks.length} notebooks`);

        // Restore headless config
        CONFIG.headless = originalHeadless;

        return {
          success: true,
          data: {
            notebooks,
            total: notebooks.length,
            message: `Found ${notebooks.length} notebooks in NotebookLM account`,
          },
        };
      } finally {
        // Close the page we created (but keep the context)
        await page.close();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`❌ [TOOL] list_notebooks_from_nblm failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Handle delete_notebooks_from_nblm tool
   *
   * Deletes notebooks from NotebookLM via browser automation.
   * Navigates to homepage, finds each notebook card, and deletes it.
   */
  async handleDeleteNotebooksFromNblm(
    args: {
      notebook_ids: string[];
      show_browser?: boolean;
    },
    sendProgress?: ProgressCallback
  ): Promise<
    ToolResult<{
      deleted: string[];
      failed: string[];
      message: string;
    }>
  > {
    const { notebook_ids, show_browser } = args;

    log.info(`🔧 [TOOL] delete_notebooks_from_nblm called`);
    log.info(`  📋 Notebooks to delete: ${notebook_ids.length}`);

    const deleted: string[] = [];
    const failed: string[] = [];

    try {
      // Apply show_browser option
      const originalHeadless = CONFIG.headless;
      if (show_browser !== undefined) {
        CONFIG.headless = !show_browser;
      }

      const sharedContextManager = this.sessionManager.getSharedContextManager();
      const context = await sharedContextManager.getOrCreateContext();
      const page = await context.newPage();

      try {
        for (let i = 0; i < notebook_ids.length; i++) {
          const notebookId = notebook_ids[i];
          await sendProgress?.(
            `Deleting notebook ${i + 1}/${notebook_ids.length}...`,
            i,
            notebook_ids.length
          );
          log.info(
            `  🗑️ Deleting notebook ${i + 1}/${notebook_ids.length}: ${notebookId.substring(0, 8)}...`
          );

          try {
            // Navigate to homepage
            await page.goto('https://notebooklm.google.com/', {
              waitUntil: 'domcontentloaded',
              timeout: 30000,
            });

            // Wait for the homepage to render at least one notebook tile.
            // The previous selector `button[aria-labelledby*="project-"]` no
            // longer matches the current NotebookLM DOM (same root cause as
            // the `list_notebooks_from_nblm` bug fixed in 1.7.5). The
            // id-based pattern `id="project-{UUID}-title"` IS stable: the
            // homepage emits one such element per notebook tile.
            await page
              .waitForSelector('[id^="project-"][id$="-title"]', { timeout: 15000 })
              .catch(() => {
                // Continue anyway — the next step will fail with a cleaner
                // error message if there really are no notebooks.
              });
            await randomDelay(1000, 2000);

            // Resolve the menu button for this notebook by walking up from
            // its title element to the nearest clickable card-like ancestor.
            //
            // Doing the walk inside `page.evaluate()` is much more robust
            // than chained Playwright locators because we can inspect the
            // structure freely and pick the right ancestor regardless of
            // whether NotebookLM wraps tiles in <button>, <a>, <div>, etc.
            const titleId = `project-${notebookId}-title`;
            const cardFound = await page.evaluate(`
              (() => {
                const titleEl = document.getElementById(${JSON.stringify(titleId)});
                if (!titleEl) return false;
                // Walk up to the card-like ancestor that contains both the
                // title and the menu button. NotebookLM tiles are bounded
                // by [role="link"] / a / button. We climb at most 6 levels.
                let node = titleEl;
                for (let i = 0; i < 6 && node; i++) {
                  if (node.getAttribute && (
                    node.getAttribute('role') === 'link' ||
                    node.tagName === 'A' ||
                    (node.tagName === 'BUTTON' && node !== titleEl)
                  )) break;
                  node = node.parentElement;
                }
                if (!node) return false;
                // Mark the card so we can target it from outside.
                node.setAttribute('data-nblm-target-card', '1');
                return true;
              })()
            `);

            if (!cardFound) {
              log.warning(`    ⚠️ Notebook tile not found on homepage: ${notebookId}`);
              failed.push(notebookId);
              continue;
            }

            // Now use the marker we just stamped to find the menu button.
            // The 3-dot menu sits inside the card (or alongside it depending
            // on NotebookLM's current layout).
            const cardContainer = page.locator('[data-nblm-target-card="1"]');
            const menuButton = cardContainer
              .locator(
                'button[aria-label*="menu" i], button[aria-label*="options" i], button[aria-label*="more" i], button[aria-label*="plus" i], button:has(mat-icon)'
              )
              .first();

            if (!(await menuButton.isVisible({ timeout: 2000 }).catch(() => false))) {
              log.warning(`    ⚠️ Menu button not found inside tile for: ${notebookId}`);
              // Clean up our marker before bailing so it doesn't stick
              // around and confuse the next iteration.
              await page
                .evaluate(
                  `document.querySelectorAll('[data-nblm-target-card="1"]').forEach(n => n.removeAttribute('data-nblm-target-card'))`
                )
                .catch(() => {});
              failed.push(notebookId);
              continue;
            }
            await menuButton.click();

            await randomDelay(500, 1000);

            // Click delete option in the menu
            const deleteButton = page
              .locator(
                'button:has-text("Supprimer"), button:has-text("Delete"), [role="menuitem"]:has-text("Supprimer"), [role="menuitem"]:has-text("Delete")'
              )
              .first();

            if ((await deleteButton.count()) === 0) {
              log.warning(`    ⚠️ Delete button not found for: ${notebookId}`);
              // Close menu by pressing Escape
              await page.keyboard.press('Escape');
              failed.push(notebookId);
              continue;
            }

            await deleteButton.click();
            await randomDelay(500, 1000);

            // Confirm deletion if a dialog appears
            const confirmButton = page
              .locator(
                'button:has-text("Supprimer"), button:has-text("Delete"), button:has-text("Confirmer"), button:has-text("Confirm")'
              )
              .first();
            if ((await confirmButton.count()) > 0) {
              await confirmButton.click();
            }

            await randomDelay(1000, 2000);

            deleted.push(notebookId);
            log.success(`    ✅ Deleted: ${notebookId.substring(0, 8)}...`);
          } catch (e) {
            const errMsg = e instanceof Error ? e.message : String(e);
            log.warning(`    ⚠️ Failed to delete ${notebookId}: ${errMsg}`);
            failed.push(notebookId);
          }
        }

        await sendProgress?.('Done!', notebook_ids.length, notebook_ids.length);
        log.success(`  ✅ Deletion complete: ${deleted.length} deleted, ${failed.length} failed`);

        CONFIG.headless = originalHeadless;

        return {
          success: true,
          data: {
            deleted,
            failed,
            message: `Deleted ${deleted.length} notebooks, ${failed.length} failed`,
          },
        };
      } finally {
        await page.close();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`❌ [TOOL] delete_notebooks_from_nblm failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Handle create_notebook tool
   *
   * Creates a new empty notebook in NotebookLM via browser automation.
   * Returns the URL of the newly created notebook.
   */
  async handleCreateNotebook(
    args: {
      name?: string;
      show_browser?: boolean;
    },
    sendProgress?: ProgressCallback
  ): Promise<
    ToolResult<{
      notebook_url: string;
      notebook_id: string;
      /** true if `name` was successfully applied (or no name was requested). false ⇒ notebook stayed as "Untitled notebook" and caller should rename it via the UI or another tool. */
      name_applied: boolean;
      /** Title actually observed on the notebook after the create+rename attempt. Empty string if no name was requested. */
      actual_name: string;
      message: string;
    }>
  > {
    const { name, show_browser } = args;

    await sendProgress?.('Creating new notebook...', 0, 5);
    log.info(`🔧 [TOOL] create_notebook called`);

    try {
      // Apply show_browser option
      const originalHeadless = CONFIG.headless;
      if (show_browser !== undefined) {
        CONFIG.headless = !show_browser;
      }

      // Get shared context manager
      const sharedContextManager = this.sessionManager.getSharedContextManager();
      const context = await sharedContextManager.getOrCreateContext();
      const page = await context.newPage();

      try {
        await sendProgress?.('Navigating to NotebookLM...', 1, 5);
        log.info('  📄 Navigating to NotebookLM homepage...');

        // Navigate to NotebookLM homepage
        await page.goto('https://notebooklm.google.com/', {
          waitUntil: 'networkidle',
          timeout: 30000,
        });
        await randomDelay(1500, 2500);

        await sendProgress?.('Clicking create button...', 2, 5);
        log.info('  🖱️  Looking for Create notebook button...');

        // Look for "Create" or "Créer" button
        const createButtonSelectors = [
          'button:has-text("Create")',
          'button:has-text("Créer")',
          'button:has-text("New notebook")',
          'button:has-text("Nouveau")',
          'button:has-text("สร้าง")',
          'button:has-text("สร้างใหม่")',
          'button:has-text("สร้างโน้ตบุ๊ก")',
          '[aria-label*="Create"]',
          '[aria-label*="Créer"]',
          '[aria-label*="New notebook"]',
          '[aria-label*="สร้าง"]',
          '[aria-label*="โน้ตบุ๊ก"]',
          '.create-notebook-button',
          'button.mdc-button:has-text("Create")',
          'button.mdc-button:has-text("สร้าง")',
        ];

        let clicked = false;
        for (const selector of createButtonSelectors) {
          try {
            const btn = page.locator(selector).first();
            if (await btn.isVisible({ timeout: 2000 })) {
              await btn.click();
              clicked = true;
              log.success(`  ✅ Clicked: ${selector}`);
              break;
            }
          } catch {
            // Try next selector
          }
        }

        if (!clicked) {
          // Try finding any button with "+" icon or create text
          const allButtons = await page.locator('button').all();
          for (const btn of allButtons) {
            const text = await btn.textContent();
            if (text && (text.includes('Create') || text.includes('Créer') || text.includes('New notebook') || text.includes('สร้าง') || text.includes('โน้ตบุ๊ก') || text.includes('+'))) {
              await btn.click();
              clicked = true;
              log.success(`  ✅ Clicked button with text: ${text}`);
              break;
            }
          }
        }

        if (!clicked) {
          throw new Error('Could not find Create notebook button');
        }

        await sendProgress?.('Waiting for notebook creation...', 3, 5);
        log.info('  ⏳ Waiting for new notebook to be created...');

        // Wait for navigation to the FINAL notebook URL.
        //
        // NotebookLM redirects through a transitional URL like
        //   https://notebooklm.google.com/notebook/creating/c
        // before landing on the real
        //   https://notebooklm.google.com/notebook/{UUID}
        //
        // The previous regex `/notebook\//` matched the transitional URL
        // immediately, so we returned `notebook/creating/c` to callers.
        // Require a full v4 UUID in the path to be sure we've landed.
        const NOTEBOOK_UUID_URL =
          /notebooklm\.google\.com\/notebook\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}(?:\b|\/|$)/;
        await page.waitForURL(NOTEBOOK_UUID_URL, { timeout: 30000 });
        // Then wait for the page to settle so the title field is editable.
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        await randomDelay(1500, 2500);

        // Parse the final URL/UUID with the same strict pattern.
        const notebookUrl = page.url();
        const notebookIdMatch = notebookUrl.match(
          /notebook\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/
        );
        if (!notebookIdMatch) {
          throw new Error(`Notebook landed on unexpected URL (no UUID): ${notebookUrl}`);
        }
        const notebookId = notebookIdMatch[1];

        await sendProgress?.('Notebook created!', 4, 5);
        log.success(`  ✅ New notebook created: ${notebookUrl}`);

        // If name provided, try to rename the notebook AND verify the
        // rename actually took effect. Previous code clicked a generic
        // selector (`[contenteditable="true"], .notebook-title, h1`),
        // typed, and trusted the keystroke without verification — so when
        // the click landed on the wrong element (anything else editable
        // on the page) the notebook silently stayed "Untitled notebook".
        let nameApplied = false;
        let observedName = '';
        if (name) {
          log.info(`  📝 Attempting rename to: ${name}`);
          // Most-specific selectors first: aria-label or placeholder that
          // explicitly indicate "title" / "Untitled". Generic contenteditable
          // is the last resort.
          const titleSelectors: Array<{ sel: string; via: 'fill' | 'type' }> = [
            { sel: 'input[aria-label*="title" i]', via: 'fill' },
            { sel: 'input[aria-label*="titre" i]', via: 'fill' },
            { sel: 'input[placeholder*="Untitled" i]', via: 'fill' },
            { sel: 'input[placeholder*="sans titre" i]', via: 'fill' },
            { sel: '[role="textbox"][aria-label*="title" i]', via: 'type' },
            { sel: '[contenteditable="true"][aria-label*="title" i]', via: 'type' },
            // Last-resort generic — only used if the targeted ones fail.
            { sel: '.notebook-title', via: 'type' },
          ];

          for (const { sel, via } of titleSelectors) {
            try {
              const el = page.locator(sel).first();
              if (!(await el.isVisible({ timeout: 1500 }).catch(() => false))) continue;

              if (via === 'fill') {
                await el.click();
                await el.fill(name);
              } else {
                await el.click();
                await el.evaluate((node: unknown) => {
                  const n = node as { textContent: string };
                  n.textContent = '';
                });
                await page.keyboard.type(name, { delay: 30 });
              }
              await page.keyboard.press('Tab'); // commit the edit
              await randomDelay(800, 1300);

              // Verify by reading what's actually in the title element now.
              const value =
                (await el.inputValue().catch(() => null)) ??
                (await el.textContent().catch(() => null)) ??
                '';
              observedName = value.trim();
              if (observedName === name.trim()) {
                log.success(`  ✅ Notebook renamed to: ${name} (selector: ${sel})`);
                nameApplied = true;
                break;
              } else {
                log.warning(
                  `  ⚠️ Rename via ${sel} did not stick: title is "${observedName}", expected "${name}"`
                );
              }
            } catch (e) {
              log.warning(`  ⚠️ Rename selector ${sel} threw: ${e}`);
            }
          }
          if (!nameApplied) {
            log.warning(
              `  ⚠️ All rename strategies failed — notebook stays as "${observedName || 'Untitled notebook'}". The 'name' param had no effect.`
            );
          }
        }

        await sendProgress?.('Done!', 5, 5);

        // Restore headless config
        CONFIG.headless = originalHeadless;

        return {
          success: true,
          data: {
            notebook_url: notebookUrl,
            notebook_id: notebookId,
            // Honest reporting: tell the caller whether the rename
            // landed (false ⇒ notebook is still "Untitled notebook").
            name_applied: name ? nameApplied : true,
            actual_name: name ? observedName : '',
            message:
              name && !nameApplied
                ? `Notebook created but rename to "${name}" failed — currently "${observedName || 'Untitled notebook'}". You may need to rename it via the UI.`
                : `Successfully created new notebook${name ? ` "${name}"` : ''}`,
          },
        };
      } finally {
        // Close the page we created (but keep the context)
        await page.close();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error(`❌ [TOOL] create_notebook failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Cleanup all resources (called on server shutdown)
   */
  async cleanup(): Promise<void> {
    log.info(`🧹 Cleaning up tool handlers...`);
    await this.sessionManager.closeAllSessions();
    log.success(`✅ Tool handlers cleanup complete`);
  }
}
