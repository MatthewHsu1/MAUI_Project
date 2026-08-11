/**
 * One synthetic row of the development test grid.
 *
 * The column set is chosen to cover every cell primitive in `src/lib/grid`:
 * text, integer, currency, enum, phone, and date.
 */
export interface TestRow {
  /**
   * Stable row key. Ids ascend with `sector`, so the unsorted order is already
   * the group order.
   */
  id: number;

  /**
   * Free text. Editable.
   */
  name: string;

  /**
   * The group field. Read-only, because moving a row between groups is not what
   * this page tests.
   */
  sector: string;

  /**
   * Region code. Index into `REGIONS`. Editable.
   */
  region: number;

  /**
   * Whole units held. Editable. One of the two inputs to `value`.
   */
  quantity: number;

  /**
   * Unit price. Editable. The other input to `value`.
   */
  price: number;

  /**
   * `quantity * price`, computed by the server. Read-only.
   *
   * It exists to prove the write-back: an edit to `quantity` or `price` changes
   * a column the client never wrote, so a stale `value` means the server row is
   * not reaching the grid.
   */
  value: number;

  /**
   * E.164 phone number. Editable.
   */
  contact: string;

  /**
   * ISO date, no time part. Editable.
   */
  updatedAt: string;

  /**
   * Active flag, drawn as a badge. Editable.
   */
  active: boolean;
}

/**
 * The 12 groups, in ascending order.
 *
 * The order is not decoration. `testGrid`'s `grouping.order` returns an index
 * into this array, and `GridGrouping.order` must agree with the ascending order
 * of the group field — see `GridGrouping` in features/dataGrid/types.ts.
 */
export const SECTORS = [
  "Aerospace",
  "Automotive",
  "Banking",
  "Chemicals",
  "Construction",
  "Energy",
  "Healthcare",
  "Insurance",
  "Logistics",
  "Media",
  "Retail",
  "Utilities",
] as const;

/**
 * Region codes and their labels. The enum cell reads `value`; `TestRow.region`
 * holds it.
 */
export const REGIONS = [
  { value: 0, label: "APAC" },
  { value: 1, label: "EMEA" },
  { value: 2, label: "Americas" },
] as const;
