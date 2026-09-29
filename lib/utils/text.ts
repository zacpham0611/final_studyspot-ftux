/**
 * Remove Vietnamese accents and convert to lower-case for robust search.
 */
export function removeAccents(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (m) => (m === 'đ' ? 'd' : 'D'))
    .toLowerCase()
    .trim();
}

/**
 * Matches target text against search query without accents.
 */
export function matchesSearch(target: string, query: string): boolean {
  if (!query) return true;
  const normalizedTarget = removeAccents(target);
  const normalizedQuery = removeAccents(query);

  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
  return queryTokens.every((token) => normalizedTarget.includes(token));
}

/**
 * Debounce helper function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  waitMs: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return function (...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      func(...args);
    }, waitMs);
  };
}
