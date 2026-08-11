import { REGIONS, SECTORS, type TestRow } from "../api/types";

/**
 * The seed every caller gets unless it names one. Fixed so a page reload shows
 * the same 100,000 rows, which is what makes a bug reproducible.
 */
export const DEFAULT_SEED = 1337;

/**
 * How many rows the development page loads.
 */
export const DEFAULT_ROW_COUNT = 100_000;

const NAME_HEADS = [
  "Northwind",
  "Silverpeak",
  "Ironwood",
  "Blue Harbor",
  "Redstone",
  "Fairview",
  "Copperline",
  "Granite",
];

const NAME_TAILS = ["Holdings", "Partners", "Group", "Industries", "Labs", "Trading"];

/**
 * A small, fast, seedable PRNG. `Math.random` cannot be seeded, and a page whose
 * data changes on every reload cannot be used to reproduce anything.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;

  return () => {
    a = (a + 0x6d2b79f5) >>> 0;

    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Rounds to two decimals, so a currency column holds a currency value. */
function money(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Builds `count` synthetic rows from `seed`. Pure: same arguments, same rows.
 *
 * The sector is a function of the row's POSITION, not of the PRNG. That is what
 * makes the ids ascend with the sector, so the unsorted order — by id — is
 * already the group order and the grid needs no extra ordering to look right
 * before the user sorts anything.
 */
export function generateRows(count: number, seed: number = DEFAULT_SEED): TestRow[] {
  const random = mulberry32(seed);
  const rows: TestRow[] = [];

  // A fixed base date keeps the rows deterministic. `Date.now()` would make two
  // runs of the same seed differ.
  const baseDate = Date.UTC(2026, 0, 1);
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i += 1) {
    const sectorIndex = Math.floor((i * SECTORS.length) / count);
    const quantity = 1 + Math.floor(random() * 5_000);
    const price = money(5 + random() * 995);

    const head = NAME_HEADS[Math.floor(random() * NAME_HEADS.length)];
    const tail = NAME_TAILS[Math.floor(random() * NAME_TAILS.length)];

    const phoneTail = String(Math.floor(random() * 10_000_000)).padStart(7, "0");
    const dayOffset = Math.floor(random() * 365);

    rows.push({
      id: i + 1,
      name: `${head} ${tail} ${i + 1}`,
      sector: SECTORS[sectorIndex],
      region: REGIONS[Math.floor(random() * REGIONS.length)].value,
      quantity,
      price,
      value: money(quantity * price),
      contact: `+1415${phoneTail}`,
      updatedAt: new Date(baseDate + dayOffset * dayMs).toISOString().slice(0, 10),
      active: random() < 0.7,
    });
  }

  return rows;
}
