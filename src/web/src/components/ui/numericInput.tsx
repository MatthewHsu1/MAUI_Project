import { forwardRef, type InputHTMLAttributes } from "react";
import { NumericFormat, type NumberFormatValues } from "react-number-format";
import { resolveNumberFormat, type NumberFormatOptions } from "../../lib/number/numberUtils";
import { Input } from "./input";

export interface NumericInputProps
  extends
    NumberFormatOptions,
    Omit<
      InputHTMLAttributes<HTMLInputElement>,
      "value" | "onChange" | "prefix" | "min" | "max" | "type" | "defaultValue"
    > {
  value: number | null;
  onChange: (value: number | null) => void;
}

/**
 * Numeric text input with configurable formatting (integer / decimal / currency)
 * and value bounds. Emits `number | null` (empty → null); out-of-range input is
 * blocked. Wraps react-number-format over the shared `Input` for consistent styling.
 */
export const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(
  (
    {
      value,
      onChange,
      format,
      decimalScale,
      currency,
      min,
      max,
      thousandSeparator,
      prefix,
      suffix,
      ...rest
    },
    ref,
  ) => {
    const resolved = resolveNumberFormat({
      format,
      decimalScale,
      currency,
      min,
      max,
      thousandSeparator,
      prefix,
      suffix,
    });

    return (
      <NumericFormat
        getInputRef={ref}
        customInput={Input}
        value={value === null ? "" : value}
        onValueChange={(values: NumberFormatValues) => onChange(values.floatValue ?? null)}
        thousandSeparator={resolved.thousandSeparator}
        decimalScale={resolved.decimalScale}
        fixedDecimalScale={resolved.fixedDecimalScale}
        prefix={resolved.prefix}
        suffix={resolved.suffix}
        allowNegative={resolved.allowNegative}
        isAllowed={resolved.isAllowed}
        {...rest}
      />
    );
  },
);

NumericInput.displayName = "NumericInput";
