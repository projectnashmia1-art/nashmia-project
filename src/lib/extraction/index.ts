/**
 * MODULAR RULE-BASED EXTRACTION ENGINE - PUBLIC API
 *
 * Deterministic, transparent, and auditable extraction pipeline
 * for processing raw email content to identify fields like Rate, Currency,
 * ETD, ETA, equipment, charges, and scheduling metadata using
 * regular expressions and keyword-matching patterns with zero AI dependencies.
 */

export * from "./types";
export * from "./rate-extractor";
export * from "./currency-extractor";
export * from "./schedule-extractor";
export * from "./container-extractor";
export * from "./charges-extractor";
export * from "./sailing-extractor";
export * from "./engine";
