/**
 * Numeric formatting/parsing core shared by the standalone NumericInput and the
 * grid number cell. Framework-free: depends only on Intl.
 */

/** Format presets. Const-object + union (no TS enums — erasableSyntaxOnly). */
export const NUMBER_FORMAT = {
  integer: "integer",
  decimal: "decimal",
  currency: "currency",
} as const;

export type NumberFormat = (typeof NUMBER_FORMAT)[keyof typeof NUMBER_FORMAT];

/** Friendly formatting options accepted by callers. */
export interface NumberFormatOptions {
  format?: NumberFormat;
  decimalScale?: number;
  currency?: string;
  min?: number;
  max?: number;
  thousandSeparator?: boolean;
  prefix?: string;
  suffix?: string;
}

/** Low-level props derived for react-number-format / Intl. */
export interface ResolvedNumberFormat {
  thousandSeparator: boolean;
  decimalScale: number | undefined;
  fixedDecimalScale: boolean;
  prefix: string | undefined;
  suffix: string | undefined;
  allowNegative: boolean;
  isAllowed: (values: { floatValue?: number }) => boolean;
}

/** The currency symbol for an ISO code (en-US locale), or '$' if unknown. */
export function currencySymbol(currency: string): string {
  try {
    const parts = new Intl.NumberFormat("en-US", { style: "currency", currency }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? "$";
  } catch {
    return "$";
  }
}

/** Inclusive bounds check. `null` (empty) is always in range; emptiness is governed elsewhere. */
export function isValueInRange(value: number | null, min?: number, max?: number): boolean {
  if (value === null) return true;
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
}

/** Resolve friendly options into react-number-format props. Explicit options always win. */
export function resolveNumberFormat(opts: NumberFormatOptions): ResolvedNumberFormat {
  const format = opts.format ?? "decimal";
  const isCurrency = format === "currency";
  const isInteger = format === "integer";

  const decimalScale = opts.decimalScale ?? (isInteger ? 0 : isCurrency ? 2 : undefined);
  const thousandSeparator = opts.thousandSeparator ?? isCurrency;
  const prefix = opts.prefix ?? (isCurrency ? currencySymbol(opts.currency ?? "USD") : undefined);
  const allowNegative = opts.min === undefined || opts.min < 0;

  const { min, max } = opts;

  const isAllowed = ({ floatValue }: { floatValue?: number }): boolean => {
    if (floatValue === undefined) return true;
    return isValueInRange(floatValue, min, max);
  };

  return {
    thousandSeparator,
    decimalScale,
    fixedDecimalScale: isCurrency,
    prefix,
    suffix: opts.suffix,
    allowNegative,
    isAllowed,
  };
}

/**
 * Parse a pasted string to a number. Strips grouping separators and currency
 * symbols. Returns `null` for empty (only when nullable), `undefined` for
 * non-numbers and out-of-range values.
 */
export function parseNumberPaste(
  raw: string,
  opts: { min?: number; max?: number; nullable: boolean },
): number | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return opts.nullable ? null : undefined;

  const cleaned = trimmed.replace(/[^0-9.-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return undefined;

  const n = Number(cleaned);

  if (!Number.isFinite(n)) return undefined;
  if (!isValueInRange(n, opts.min, opts.max)) return undefined;

  return n;
}

/** Format a number for static display (grid canvas), consistent with the editor. */
export function formatNumberDisplay(value: number, opts: NumberFormatOptions): string {
  const r = resolveNumberFormat(opts);

  const formatted = new Intl.NumberFormat("en-US", {
    useGrouping: r.thousandSeparator,
    minimumFractionDigits: r.fixedDecimalScale ? r.decimalScale : 0,
    maximumFractionDigits: r.decimalScale ?? 20,
  }).format(value);

  return (r.prefix ?? "") + formatted + (r.suffix ?? "");
}
