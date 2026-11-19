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

/**
 * Merges a freshly loaded list with local optimistic changes:
 * entries whose id is pending keep their local (optimistic) version,
 * so a reload that finishes mid-write does not undo the optimistic change.
 */
export function mergePending<T>(
  loaded: readonly T[],
  local: readonly T[],
  pendingIds: ReadonlySet<string>,
  idOf: (item: T) => string,
): readonly T[] {
  if (pendingIds.size === 0) return loaded;
  return [
    ...loaded.filter((item) => !pendingIds.has(idOf(item))),
    ...local.filter((item) => pendingIds.has(idOf(item))),
  ];
}
