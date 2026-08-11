import type { components } from "../../../api/schema.gen";

/**
 * The bonds API's wire types, given domain names.
 *
 * Generated schema types are used directly — there is no mapping layer, because
 * the shapes are identical and a 1:1 mapper is drift risk with no benefit. This
 * file exists so the rest of the feature never reaches into `schema.gen`: if a
 * DTO is renamed upstream, only the alias here changes.
 *
 * Introduce a hand-written type (and a transform in the query) only when one is
 * genuinely needed — a computed field, or parsing `asOf` into a `Date`.
 */

/** A convertible bond's conversion valuation, exactly as the API defines it. */
export type ConversionValuation = components["schemas"]["ConversionValuationDto"];
