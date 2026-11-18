const PAGE_SIZE = 1000;

/**
 * PostgREST liefert höchstens 1000 Zeilen je Abfrage. Ohne Blättern fehlten
 * ab Zeile 1001 still Einträge, und schon verrechnete Aufträge erschienen
 * wieder als offen. Die Abfrage braucht eine eindeutige Sortierung, sonst
 * können Zeilen zwischen zwei Seiten verrutschen.
 */
export async function fetchAll<T>(
  page: (
    from: number,
    to: number
  ) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}
