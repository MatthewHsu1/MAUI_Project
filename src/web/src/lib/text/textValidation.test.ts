import { describe, expect, it } from "vitest";
import { validateText } from "./textValidation";

describe("validateText — required & emptiness", () => {
  it("empty + optional is valid and skips other rules", () => {
    expect(validateText("", { minLength: 5, email: true })).toEqual({ valid: true });
  });
  it("empty + required fails with the required message", () => {
    expect(validateText("", { required: true })).toEqual({
      valid: false,
      error: "This field is required",
    });
  });
  it("non-empty passes required", () => {
    expect(validateText("x", { required: true }).valid).toBe(true);
  });
});

describe("validateText — length", () => {
  it("rejects below minLength", () => {
    expect(validateText("ab", { minLength: 3 })).toEqual({
      valid: false,
      error: "Must be at least 3 characters",
    });
  });
  it("accepts at the minLength boundary", () => {
    expect(validateText("abc", { minLength: 3 }).valid).toBe(true);
  });
  it("rejects above maxLength", () => {
    expect(validateText("abcd", { maxLength: 3 })).toEqual({
      valid: false,
      error: "Must be at most 3 characters",
    });
  });
  it("accepts at the maxLength boundary", () => {
    expect(validateText("abc", { maxLength: 3 }).valid).toBe(true);
  });
});

describe("validateText — email", () => {
  it("accepts a well-formed address", () => {
    expect(validateText("a@b.co", { email: true }).valid).toBe(true);
  });
  it("rejects a malformed address", () => {
    expect(validateText("a@b", { email: true })).toEqual({
      valid: false,
      error: "Enter a valid email address",
    });
    expect(validateText("a b@c.com", { email: true }).valid).toBe(false);
  });
});

describe("validateText — pattern", () => {
  it("RegExp form uses the default message", () => {
    expect(validateText("abc", { pattern: /^\d+$/ })).toEqual({
      valid: false,
      error: "Invalid format",
    });
  });
  it("object form uses the supplied message", () => {
    expect(validateText("abc", { pattern: { value: /^\d+$/, message: "Digits only" } })).toEqual({
      valid: false,
      error: "Digits only",
    });
  });
  it("accepts a matching value", () => {
    expect(validateText("123", { pattern: /^\d+$/ }).valid).toBe(true);
  });
});

describe("validateText — custom validate", () => {
  it("uses the returned message as the error", () => {
    expect(validateText("foo", { validate: (v) => (v === "bar" ? null : "Must be bar") })).toEqual({
      valid: false,
      error: "Must be bar",
    });
  });
  it("passes when the custom rule returns null", () => {
    expect(
      validateText("bar", { validate: (v) => (v === "bar" ? null : "Must be bar") }).valid,
    ).toBe(true);
  });
});

describe("validateText — priority (first failing rule wins)", () => {
  it("required is reported before email", () => {
    expect(validateText("", { required: true, email: true })).toEqual({
      valid: false,
      error: "This field is required",
    });
  });
  it("minLength is reported before email", () => {
    expect(validateText("a@", { minLength: 5, email: true })).toEqual({
      valid: false,
      error: "Must be at least 5 characters",
    });
  });
});
