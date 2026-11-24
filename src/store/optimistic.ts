/**
 * Small immutable helpers shared by the optimistic stores.
 * Every store keeps `pendingIds` as a ReadonlySet and replaces it on change,
 * so zustand selectors see a new reference.
 */

export type LoadStatus = "idle" | "loading" | "ready" | "error";

export function withId(
  ids: ReadonlySet<string>,
  id: string,
): ReadonlySet<string> {
  if (ids.has(id)) return ids;
  const next = new Set(ids);
  next.add(id);
  return next;
}

export function withoutId(
  ids: ReadonlySet<string>,
  id: string,
): ReadonlySet<string> {
  if (!ids.has(id)) return ids;
  const next = new Set(ids);
  next.delete(id);
  return next;
}

export function unionIds(
  a: ReadonlySet<string>,
  b: ReadonlySet<string>,
): ReadonlySet<string> {
  if (b.size === 0) return a;
  if (a.size === 0) return b;
  return new Set([...a, ...b]);
}

/**
 * Merges a freshly loaded list with local state.
 *
 * `protectedIds` are ids whose local state is newer than the loaded list:
 * writes still in flight (`pendingIds`) and writes that settled – saved or
 * rolled back – after the load started. For those ids the local state wins:
 * a local item is kept, and an id missing locally (removed, or an add that
 * was rolled back) stays missing even if the stale list still has it.
 */
export function mergePending<T>(
  loaded: readonly T[],
  local: readonly T[],
  protectedIds: ReadonlySet<string>,
  idOf: (item: T) => string,
): readonly T[] {
  if (protectedIds.size === 0) return loaded;
  return [
    ...loaded.filter((item) => !protectedIds.has(idOf(item))),
    ...local.filter((item) => protectedIds.has(idOf(item))),
  ];
}
