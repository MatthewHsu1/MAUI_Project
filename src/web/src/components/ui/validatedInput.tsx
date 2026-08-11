import { forwardRef, useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";
import { Input } from "./input";
import { validateText, type TextValidationOptions } from "../../lib/text/textValidation";

export interface ValidatedInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange"
> {
  value: string;
  onChange: (value: string) => void;
  validation: TextValidationOptions;
  onValidityChange?: (valid: boolean) => void;
}

/**
 * Text input with configurable validation (required, min/max length, email,
 * regex, custom). Shows the first failing rule as a red border + message, but
 * only after the field has been touched (blurred once). `maxLength` is enforced
 * natively so over-typing is blocked; every other rule reports on change.
 * Wraps the shared `Input` for consistent styling.
 */
export const ValidatedInput = forwardRef<HTMLInputElement, ValidatedInputProps>(
  (
    { value, onChange, validation, onValidityChange, className, onBlur, maxLength, ...rest },
    ref,
  ) => {
    const [touched, setTouched] = useState(false);
    const result = validateText(value, validation);
    const valid = result.valid;
    const error = result.valid ? null : result.error;

    // Fire onValidityChange when validity flips (and on mount), without
    // re-firing when the parent passes a fresh callback identity each render.
    const validityCb = useRef(onValidityChange);

    validityCb.current = onValidityChange;

    useEffect(() => {
      validityCb.current?.(valid);
    }, [valid]);

    const showError = touched && !valid;

    return (
      <div className="flex flex-col gap-1">
        <Input
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => {
            setTouched(true);
            onBlur?.(e);
          }}
          maxLength={maxLength ?? validation.maxLength}
          aria-invalid={showError || undefined}
          className={cn(
            showError && "border-[var(--red-9)] focus-visible:ring-[var(--red-8)]",
            className,
          )}
          {...rest}
        />
        {showError && <span className="text-xs text-[var(--red-11)]">{error}</span>}
      </div>
    );
  },
);

ValidatedInput.displayName = "ValidatedInput";
