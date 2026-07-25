import { describe, it, expect } from '@jest/globals';
import {
  isNotebookHost,
  isNotebookUrl,
  NOTEBOOK_BASE_URL,
  NOTEBOOK_PRIMARY_HOST,
} from '../utils/notebook-domain.js';

describe('notebook-domain host validation', () => {
  it('accepts both notebook hosts', () => {
    expect(isNotebookHost('notebooklm.google.com')).toBe(true);
    expect(isNotebookHost('notebook.google.com')).toBe(true);
    expect(isNotebookUrl('https://notebooklm.google.com/notebook/abc')).toBe(true);
    expect(isNotebookUrl('https://notebook.google.com/notebook/abc')).toBe(true);
  });

  it('rejects non-notebook hosts', () => {
    expect(isNotebookHost('evil.com')).toBe(false);
    expect(isNotebookUrl('https://notebooklm.google.com.evil.com/')).toBe(false);
    expect(isNotebookUrl('not a url')).toBe(false);
  });

  // The reason isNotebookUrl parses instead of substring-matching: a notebook
  // host inside a query param must NOT pass URL validation (bypass guard).
  it('does not false-match a notebook host in a continue= param', () => {
    const signin = 'https://accounts.google.com/v3/signin?continue=https://notebooklm.google.com/';
    expect(isNotebookUrl(signin)).toBe(false);
  });

  it('canonical entry host is Google-documented', () => {
    expect(NOTEBOOK_PRIMARY_HOST).toBe('notebooklm.google.com');
    expect(NOTEBOOK_BASE_URL).toBe('https://notebooklm.google.com/');
  });
});
