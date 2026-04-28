/**
 * Phase 13.11 — reference data DTOs.
 *
 * Two simple endpoints (business-types + countries) used by the
 * become-seller form and the registration form respectively. No
 * filters, no body — types-only, no zod schemas.
 */

export interface BusinessType {
  typeId: number;
  name: string;
  description: string;
}

export interface Country {
  countryId: number;
  countryCode: number;
  name: string;
}
