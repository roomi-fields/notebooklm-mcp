#!/usr/bin/env node

/**
 * Periodically sync notebooks discovered from the authenticated NotebookLM
 * account into the HTTP server's local library.
 */

const serverUrl = (
  process.env.NOTEBOOKLM_SERVER_URL ||
  process.env.MCP_HTTP_URL ||
  'http://127.0.0.1:3000'
).replace(/\/$/, '');

const intervalSeconds = Number.parseInt(
  process.env.AUTO_IMPORT_NOTEBOOKS_INTERVAL || '600',
  10
);
const syncOnStartup = process.env.AUTO_IMPORT_NOTEBOOKS_ON_STARTUP !== 'false';
const autoDiscover = process.env.AUTO_DISCOVER_IMPORTED_NOTEBOOKS === 'true';
const showBrowser = process.env.AUTO_IMPORT_SHOW_BROWSER === 'true';

if (!Number.isFinite(intervalSeconds) || intervalSeconds < 60) {
  console.error('[auto-sync] AUTO_IMPORT_NOTEBOOKS_INTERVAL must be at least 60 seconds');
  process.exit(1);
}

let syncInProgress = false;

async function syncNotebooks(): Promise<void> {
  if (syncInProgress) {
    console.error('[auto-sync] Previous sync is still running; skipping this interval');
    return;
  }

  syncInProgress = true;
  const startedAt = new Date();
  console.error(`[auto-sync] Starting notebook sync at ${startedAt.toISOString()}`);

  try {
    const response = await fetch(`${serverUrl}/notebooks/import-from-scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auto_discover: autoDiscover,
        show_browser: showBrowser,
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    const result = JSON.parse(text) as {
      success?: boolean;
      error?: string;
      data?: {
        total_scraped?: number;
        total_imported?: number;
        total_errors?: number;
      };
    };

    if (!result.success) {
      throw new Error(result.error || 'Notebook sync failed');
    }

    console.error(
      `[auto-sync] Completed: discovered=${result.data?.total_scraped ?? 0} ` +
        `imported=${result.data?.total_imported ?? 0} errors=${result.data?.total_errors ?? 0}`
    );
  } catch (error) {
    console.error(
      `[auto-sync] Failed: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    syncInProgress = false;
  }
}

if (syncOnStartup) {
  await syncNotebooks();
}

console.error(
  `[auto-sync] Scheduler active: server=${serverUrl} interval=${intervalSeconds}s ` +
    `autoDiscover=${autoDiscover}`
);

const timer = setInterval(() => {
  void syncNotebooks();
}, intervalSeconds * 1000);

timer.unref?.();

await new Promise<void>((resolve) => {
  const stop = (): void => {
    clearInterval(timer);
    resolve();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
});
