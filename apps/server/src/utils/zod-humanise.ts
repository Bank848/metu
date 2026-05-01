import type { ZodError, ZodIssue } from "zod";

// Camel-case / snake-case keys turn into "Title Case" for the user-
// facing message. e.g. "phoneNumber" -> "Phone number", "first_name"
// -> "First name".
function humaniseField(rawPath: ZodIssue["path"]): string {
  if (!rawPath.length) return "Value";
  const last = rawPath[rawPath.length - 1];
  if (typeof last === "number") return "Item";
  const spaced = String(last)
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// Map a single Zod issue to a friendly sentence. Falls back to the
// issue's own message if we don't have a tailored phrasing.
function humaniseIssue(issue: ZodIssue, field: string): string {
  switch (issue.code) {
    case "invalid_type":
      if (issue.received === "undefined") return `${field} is required.`;
      return `${field} doesn't look right.`;
    case "too_small": {
      const min = (issue as { minimum?: number }).minimum;
      if (issue.type === "string") {
        if (min === 1) return `${field} can't be empty.`;
        return `${field} must be at least ${min} characters.`;
      }
      if (issue.type === "number") return `${field} must be at least ${min}.`;
      if (issue.type === "array") return `Add at least ${min} ${field.toLowerCase()}.`;
      return `${field} is too small.`;
    }
    case "too_big": {
      const max = (issue as { maximum?: number }).maximum;
      if (issue.type === "string") return `${field} must be at most ${max} characters.`;
      if (issue.type === "number") return `${field} can be at most ${max}.`;
      if (issue.type === "array") return `${field} can have at most ${max} entries.`;
      return `${field} is too long.`;
    }
    case "invalid_string": {
      const validation = (issue as { validation?: string }).validation;
      if (validation === "email") return `That email isn't valid.`;
      if (validation === "url") return `${field} must be a valid URL.`;
      if (validation === "uuid") return `${field} must be a valid ID.`;
      if (validation === "regex") return `${field} isn't in the right format.`;
      return `${field} isn't valid.`;
    }
    case "invalid_enum_value":
      return `${field} must be one of the allowed values.`;
    case "unrecognized_keys":
      return `Unexpected field in the request.`;
    case "custom":
      return issue.message ?? `${field} isn't valid.`;
    default:
      return issue.message ?? `${field} isn't valid.`;
  }
}

/**
 * Convert a ZodError into a single user-readable message + the field
 * that triggered it. Used by the Express error handler to replace the
 * raw `error.errors` JSON dump that buyers/sellers used to see.
 */
export function humaniseZodError(err: ZodError): {
  message: string;
  field: string | null;
} {
  // Use `issues` directly — `errors` is just a getter alias in v3 and
  // some duplicated copies of zod (test runner / monorepo) don't ship
  // the alias.
  const issues = (err as { issues?: ZodIssue[] }).issues ?? err.errors ?? [];
  const first = issues[0];
  if (!first) return { message: "Validation failed.", field: null };
  const field = humaniseField(first.path);
  const message = humaniseIssue(first, field);
  const fieldName =
    first.path.length && typeof first.path[first.path.length - 1] !== "number"
      ? String(first.path[first.path.length - 1])
      : null;
  return { message, field: fieldName };
}
