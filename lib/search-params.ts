/** What Next.js passes as `searchParams` (after awaiting). */
export type SearchParams = Record<string, string | string[] | undefined>;

/** Keeps the first value of repeated query keys, e.g. ?status=A&status=B -> "A". */
export function flattenParams(params: SearchParams): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
}
