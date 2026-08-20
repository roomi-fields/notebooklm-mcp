export interface CitationSource {
  title: string;
  sourceUrl?: string;
  pageNumber?: number;
  snippet: string;
}

export function validateCitation(source: Partial<CitationSource>): boolean {
  return typeof source.title === "string" && source.title.trim().length > 0;
}
