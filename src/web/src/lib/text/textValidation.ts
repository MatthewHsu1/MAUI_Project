/**
 * Text validation core shared by the standalone <ValidatedInput> and the grid
 * text cell. Framework-free: no React, no DOM. Mirrors numberUtils in spirit.
 */

/** Flat, declarative validation rules. */
export interface TextValidationOptions {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  email?: boolean;
  pattern?: RegExp | { value: RegExp; message: string };
  /** Custom rule escape hatch: return an error message, or null when valid. */
  validate?: (value: string) => string | null;
}

/**
 * Validity, plus the first failing rule's message when invalid. The union makes
 * "invalid with no message" unrepresentable: `valid: false` always carries an
 * `error`, and `valid: true` never does — enforced by the type, not discipline.
 */
export type TextValidationResult = { valid: true } | { valid: false; error: string };

/** Pragmatic email check (intentionally not full RFC 5322). */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ok: TextValidationResult = { valid: true };
const fail = (error: string): TextValidationResult => ({ valid: false, error });

/**
 * Validate a string against the configured rules, returning the first failing
 * rule's message. Empty ('') is valid unless `required`; when empty-and-optional
 * the remaining rules are skipped (mirrors how a null number is always in range).
 *
 * Priority: required -> minLength -> maxLength -> email -> pattern -> validate.
 */
export function validateText(value: string, opts: TextValidationOptions): TextValidationResult {
  if (value === "") {
    return opts.required ? fail("This field is required") : ok;
  }

  if (opts.minLength !== undefined && value.length < opts.minLength) {
    return fail(`Must be at least ${opts.minLength} characters`);
  }

  if (opts.maxLength !== undefined && value.length > opts.maxLength) {
    return fail(`Must be at most ${opts.maxLength} characters`);
  }

  if (opts.email && !EMAIL_PATTERN.test(value)) {
    return fail("Enter a valid email address");
  }

  if (opts.pattern) {
    const regex = opts.pattern instanceof RegExp ? opts.pattern : opts.pattern.value;
    const message = opts.pattern instanceof RegExp ? "Invalid format" : opts.pattern.message;

    if (!regex.test(value)) {
      return fail(message);
    }
  }

  if (opts.validate) {
    const message = opts.validate(value);

    if (message !== null) {
      return fail(message);
    }
  }

  return ok;
}
