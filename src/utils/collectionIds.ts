export function applyIdMapToCollection<TItem extends { id: string }>(
  items: TItem[],
  idMap?: Record<string, string>,
): TItem[] {
  if (!idMap || Object.keys(idMap).length === 0) {
    return items;
  }

  return items.map((item) => {
    const nextId = idMap[item.id];
    return nextId ? { ...item, id: nextId } : item;
  });
}
