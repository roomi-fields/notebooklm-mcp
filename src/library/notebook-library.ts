/**
 * NotebookLM Library Manager
 *
 * Manages a persistent library of NotebookLM notebooks.
 * Allows Claude to autonomously add, remove, and switch between
 * multiple notebooks based on the task at hand.
 */

import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config.js';
import { log } from '../utils/logger.js';
import type {
  NotebookEntry,
  Library,
  AddNotebookInput,
  UpdateNotebookInput,
  LibraryStats,
} from './types.js';
import type { SessionManager } from '../session/session-manager.js';

export class NotebookLibrary {
  private libraryPath: string;
  private library: Library;
  private sessionManager?: SessionManager;

  constructor(sessionManager?: SessionManager) {
    this.sessionManager = sessionManager;
    this.libraryPath = path.join(CONFIG.dataDir, 'library.json');
    this.library = this.loadLibrary();

    log.info('📚 NotebookLibrary initialized');
    log.info(`  Library path: ${this.libraryPath}`);
    log.info(`  Notebooks: ${this.library.notebooks.length}`);
    if (this.library.active_notebook_id) {
      log.info(`  Active: ${this.library.active_notebook_id}`);
    }
  }

  /**
   * Load library from disk, or create default if not exists
   */
  private loadLibrary(): Library {
    try {
      if (fs.existsSync(this.libraryPath)) {
        const data = fs.readFileSync(this.libraryPath, 'utf-8');
        const library = JSON.parse(data) as Library;
        log.success(`  ✅ Loaded library with ${library.notebooks.length} notebooks`);
        return library;
      }
    } catch (error) {
      log.warning(`  ⚠️  Failed to load library: ${error}`);
    }

    // Create default library with current CONFIG as first entry
    log.info('  🆕 Creating new library...');
    const defaultLibrary = this.createDefaultLibrary();
    this.saveLibrary(defaultLibrary);
    return defaultLibrary;
  }

  /**
   * Create default library from current CONFIG
   */
  private createDefaultLibrary(): Library {
    const hasConfig =
      CONFIG.notebookUrl &&
      CONFIG.notebookDescription &&
      CONFIG.notebookDescription !==
        "General knowledge base - configure NOTEBOOK_DESCRIPTION to help Claude understand what's in this notebook";

    const notebooks: NotebookEntry[] = [];

    if (hasConfig) {
      // Create first entry from CONFIG
      const id = this.generateId(CONFIG.notebookDescription);
      notebooks.push({
        id,
        url: CONFIG.notebookUrl,
        name: CONFIG.notebookDescription.substring(0, 50), // First 50 chars as name
        description: CONFIG.notebookDescription,
        topics: CONFIG.notebookTopics,
        content_types: CONFIG.notebookContentTypes,
        use_cases: CONFIG.notebookUseCases,
        added_at: new Date().toISOString(),
        last_used: new Date().toISOString(),
        use_count: 0,
        tags: [],
      });

      log.success(`  ✅ Created default notebook: ${id}`);
    }

    return {
      notebooks,
      active_notebook_id: notebooks.length > 0 ? notebooks[0].id : null,
      last_modified: new Date().toISOString(),
      version: '1.0.0',
    };
  }

  /**
   * Save library to disk
   */
  private saveLibrary(library: Library): void {
    try {
      library.last_modified = new Date().toISOString();
      const data = JSON.stringify(library, null, 2);
      fs.writeFileSync(this.libraryPath, data, 'utf-8');
      this.library = library;
      log.success(`  💾 Library saved (${library.notebooks.length} notebooks)`);
    } catch (error) {
      log.error(`  ❌ Failed to save library: ${error}`);
      throw error;
    }
  }

  /**
   * Generate a unique ID from a string (slug format)
   */
  private generateId(name: string): string {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 30);

    // Ensure uniqueness
    let id = base;
    let counter = 1;
    while (this.library.notebooks.some((n) => n.id === id)) {
      id = `${base}-${counter}`;
      counter++;
    }

    return id;
  }

  /**
   * Add a new notebook to the library
   */
  async addNotebook(input: AddNotebookInput): Promise<NotebookEntry> {
    log.info(`📝 Adding notebook: ${input.name}`);

    // Check if a notebook with this name already exists
    const existingWithSameName = this.library.notebooks.find(
      (n) => n.name.toLowerCase() === input.name.toLowerCase()
    );
    if (existingWithSameName) {
      throw new Error(
        `A notebook with the name '${input.name}' already exists.\n\n` +
          `Existing notebook ID: ${existingWithSameName.id}\n` +
          `URL: ${existingWithSameName.url}\n\n` +
          `Please use a different name, or update the existing notebook instead.\n` +
          `To update: PUT /notebooks/${existingWithSameName.id} with new data\n` +
          `To delete: DELETE /notebooks/${existingWithSameName.id}`
      );
    }

    // Validate URL format
    if (!this.isValidNotebookUrl(input.url)) {
      throw new Error(
        `Invalid NotebookLM URL: ${input.url}\n\n` +
          `Expected format: https://notebooklm.google.com/notebook/[notebook-id]\n\n` +
          `Example: https://notebooklm.google.com/notebook/abc-123-def-456\n\n` +
          `To get the URL:\n` +
          `1. Go to https://notebooklm.google.com\n` +
          `2. Open your notebook\n` +
          `3. Copy the URL from the address bar`
      );
    }

    // Validate notebook exists (live check)
    await this.validateNotebookExists(input.url);

    // Generate ID
    const id = this.generateId(input.name);

    // Create entry
    const notebook: NotebookEntry = {
      id,
      url: input.url,
      name: input.name,
      description: input.description,
      topics: input.topics,
      content_types: input.content_types || ['documentation', 'examples'],
      use_cases: input.use_cases || [
        `Learning about ${input.name}`,
        `Implementing features with ${input.name}`,
      ],
      added_at: new Date().toISOString(),
      last_used: new Date().toISOString(),
      use_count: 0,
      tags: input.tags || [],
      auto_generated: input.auto_generated || false,
    };

    // Add to library
    const updated = { ...this.library };
    updated.notebooks.push(notebook);

    // Set as active if it's the first notebook
    if (updated.notebooks.length === 1) {
      updated.active_notebook_id = id;
    }

    this.saveLibrary(updated);
    log.success(`✅ Notebook added: ${id}`);

    return notebook;
  }

  /**
   * Validate NotebookLM URL format
   */
  private isValidNotebookUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return (
        urlObj.hostname === 'notebooklm.google.com' &&
        urlObj.pathname.startsWith('/notebook/') &&
        urlObj.pathname.length > '/notebook/'.length
      );
    } catch {
      return false;
    }
  }

  /**
   * Validate that the notebook exists and is accessible
   * Opens the notebook briefly to check if it loads correctly
   */
  async validateNotebookExists(url: string): Promise<void> {
    if (!this.sessionManager) {
      log.warning('  ⚠️  SessionManager not available, skipping live validation');
      return;
    }

    log.info('  🔍 Validating notebook exists (creating temporary session)...');

    const tempSessionId = `validate-${Date.now()}`;

    try {
      // Use SessionManager to create a session (which will validate the notebook)
      await this.sessionManager.getOrCreateSession(
        tempSessionId,
        url,
        true // headless
      );

      log.success('  ✅ Notebook validated successfully!');

      // Close the validation session immediately
      await this.sessionManager.closeSession(tempSessionId);
    } catch (error) {
      if (error instanceof Error) {
        // Parse the error to give better feedback
        const errorMsg = error.message;

        if (errorMsg.includes('Could not find NotebookLM chat input')) {
          throw new Error(
            `Invalid or inaccessible notebook.\n\n` +
              `URL: ${url}\n\n` +
              `The notebook page loaded but the chat interface was not found.\n` +
              `This usually means:\n` +
              `- The notebook doesn't exist\n` +
              `- You don't have access to this notebook\n` +
              `- The notebook ID in the URL is incorrect\n\n` +
              `Please verify the URL by:\n` +
              `1. Go to https://notebooklm.google.com\n` +
              `2. Open the notebook manually\n` +
              `3. Copy the exact URL from the address bar`
          );
        }

        throw new Error(
          `Failed to validate notebook:\n${errorMsg}\n\n` +
            `Please verify:\n` +
            `1. The URL is correct: ${url}\n` +
            `2. You have access to this notebook\n` +
            `3. You are authenticated (run setup-auth if needed)`
        );
      }
      throw error;
    }
  }

  /**
   * List all notebooks in library
   */
  listNotebooks(): NotebookEntry[] {
    return this.library.notebooks;
  }

  /**
   * Get a specific notebook by ID
   */
  getNotebook(id: string): NotebookEntry | null {
    return this.library.notebooks.find((n) => n.id === id) || null;
  }

  /**
   * Get the currently active notebook
   */
  getActiveNotebook(): NotebookEntry | null {
    if (!this.library.active_notebook_id) {
      return null;
    }
    return this.getNotebook(this.library.active_notebook_id);
  }

  /**
   * Select a notebook as active
   */
  selectNotebook(id: string): NotebookEntry {
    const notebook = this.getNotebook(id);
    if (!notebook) {
      throw new Error(`Notebook not found: ${id}`);
    }

    log.info(`🎯 Selecting notebook: ${id}`);

    const updated = { ...this.library };
    updated.active_notebook_id = id;

    // Update last_used
    const notebookIndex = updated.notebooks.findIndex((n) => n.id === id);
    updated.notebooks[notebookIndex] = {
      ...notebook,
      last_used: new Date().toISOString(),
    };

    this.saveLibrary(updated);
    log.success(`✅ Active notebook: ${id}`);

    return updated.notebooks[notebookIndex];
  }

  /**
   * Update notebook metadata
   */
  updateNotebook(input: UpdateNotebookInput): NotebookEntry {
    const notebook = this.getNotebook(input.id);
    if (!notebook) {
      throw new Error(`Notebook not found: ${input.id}`);
    }

    log.info(`📝 Updating notebook: ${input.id}`);

    const updated = { ...this.library };
    const index = updated.notebooks.findIndex((n) => n.id === input.id);

    updated.notebooks[index] = {
      ...notebook,
      ...(input.name && { name: input.name }),
      ...(input.description && { description: input.description }),
      ...(input.topics && { topics: input.topics }),
      ...(input.content_types && { content_types: input.content_types }),
      ...(input.use_cases && { use_cases: input.use_cases }),
      ...(input.tags && { tags: input.tags }),
      ...(input.url && { url: input.url }),
    };

    this.saveLibrary(updated);
    log.success(`✅ Notebook updated: ${input.id}`);

    return updated.notebooks[index];
  }

  /**
   * Remove notebook from library
   */
  removeNotebook(id: string): boolean {
    const notebook = this.getNotebook(id);
    if (!notebook) {
      return false;
    }

    log.info(`🗑️  Removing notebook: ${id}`);

    const updated = { ...this.library };
    updated.notebooks = updated.notebooks.filter((n) => n.id !== id);

    // If we removed the active notebook, select another one
    if (updated.active_notebook_id === id) {
      updated.active_notebook_id = updated.notebooks.length > 0 ? updated.notebooks[0].id : null;
    }

    this.saveLibrary(updated);
    log.success(`✅ Notebook removed: ${id}`);

    return true;
  }

  /**
   * Increment use count for a notebook
   */
  incrementUseCount(id: string): NotebookEntry | null {
    const notebookIndex = this.library.notebooks.findIndex((n) => n.id === id);
    if (notebookIndex === -1) {
      return null;
    }

    const notebook = this.library.notebooks[notebookIndex];
    const updated = { ...this.library };
    const updatedNotebook: NotebookEntry = {
      ...notebook,
      use_count: notebook.use_count + 1,
      last_used: new Date().toISOString(),
    };

    updated.notebooks[notebookIndex] = updatedNotebook;
    this.saveLibrary(updated);

    return updatedNotebook;
  }

  /**
   * Get library statistics
   */
  getStats(): LibraryStats {
    const totalQueries = this.library.notebooks.reduce((sum, n) => sum + n.use_count, 0);

    const mostUsed = this.library.notebooks.reduce(
      (max, n) => (n.use_count > (max?.use_count || 0) ? n : max),
      null as NotebookEntry | null
    );

    return {
      total_notebooks: this.library.notebooks.length,
      active_notebook: this.library.active_notebook_id,
      most_used_notebook: mostUsed?.id || null,
      total_queries: totalQueries,
      last_modified: this.library.last_modified,
    };
  }

  /**
   * Search notebooks by query (searches name, description, topics)
   */
  searchNotebooks(query: string): NotebookEntry[] {
    const lowerQuery = query.toLowerCase();
    return this.library.notebooks.filter(
      (n) =>
        n.name.toLowerCase().includes(lowerQuery) ||
        n.description.toLowerCase().includes(lowerQuery) ||
        n.topics.some((t) => t.toLowerCase().includes(lowerQuery)) ||
        n.tags?.some((t) => t.toLowerCase().includes(lowerQuery))
    );
  }
}
