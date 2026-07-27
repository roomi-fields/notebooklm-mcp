import { describe, it, expect } from '@jest/globals';
import {
  isNotebookHost,
  isNotebookUrl,
  withUiLocale,
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

// The account's language setting overrides the browser locale in the rendered
// UI, silently breaking every text-based selector. hl=<locale> is the only
// per-request override that wins over the account preference.
describe('withUiLocale', () => {
  it('appends hl to notebook app URLs', () => {
    expect(withUiLocale(NOTEBOOK_BASE_URL, 'en')).toBe('https://notebooklm.google.com/?hl=en');
    expect(withUiLocale('https://notebook.google.com/notebook/abc-123', 'fr')).toBe(
      'https://notebook.google.com/notebook/abc-123?hl=fr'
    );
  });

  it('preserves existing query params and fragments', () => {
    expect(withUiLocale('https://notebooklm.google.com/notebook/abc?foo=1', 'en')).toBe(
      'https://notebooklm.google.com/notebook/abc?foo=1&hl=en'
    );
  });

  it('does not override an hl the user already chose', () => {
    const url = 'https://notebooklm.google.com/?hl=fr';
    expect(withUiLocale(url, 'en')).toBe(url);
  });

  it('leaves non-notebook and invalid URLs untouched', () => {
    expect(withUiLocale('https://example.com/', 'en')).toBe('https://example.com/');
    expect(withUiLocale('not a url', 'en')).toBe('not a url');
  });

  // CONFIG mocks in unit tests may omit uiLocale — a missing locale must never
  // produce a literal "hl=undefined" query param.
  it('returns the URL unchanged when locale is missing', () => {
    expect(withUiLocale(NOTEBOOK_BASE_URL, undefined)).toBe(NOTEBOOK_BASE_URL);
    expect(withUiLocale(NOTEBOOK_BASE_URL, '')).toBe(NOTEBOOK_BASE_URL);
  });
});
