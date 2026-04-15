const BENCHMARK_QUERY_KEYS = ['bench', 'benchmark', 'lh'];

export function isBenchmarkMode(search: string | null | undefined): boolean {
  if (!search) {
    return false;
  }

  const params = new URLSearchParams(search);
  return BENCHMARK_QUERY_KEYS.some((key) => params.has(key));
}

export function isBenchmarkBrowserSession(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return isBenchmarkMode(window.location.search);
}