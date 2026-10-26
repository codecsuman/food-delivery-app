/**
 * Helpers for checking that a write actually persisted.
 *
 * A frontend can be deployed before its backend. In that case an old backend
 * may accept a request (HTTP 200) but silently drop fields that are not in its
 * Mongoose schema. Mongoose strict mode is the usual culprit: unknown paths are
 * ignored instead of rejected. Comparing the values the form submitted with the
 * values the API returned turns that silent data loss into a visible error.
 */

const normalize = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" && Number.isNaN(value)) return "";
  return String(value).trim();
};

/**
 * Return the keys whose submitted value does not match the value returned by
 * the API. Phone numbers and other numeric fields are normalised to strings, so
 * `"9876543210"` and `9876543210` compare equal. Null and undefined both mean
 * "empty", which is how the API represents a cleared optional field.
 */
export const findUnpersistedFields = (
  submitted: Record<string, unknown>,
  saved: Record<string, unknown> | null | undefined,
  skip: string[] = [],
): string[] => {
  if (!saved) return Object.keys(submitted).filter((key) => !skip.includes(key));

  const skipped = new Set(skip);
  return Object.entries(submitted)
    .filter(([key, expected]) => {
      if (skipped.has(key) || expected === undefined) return false;
      return normalize(expected) !== normalize(saved[key]);
    })
    .map(([key]) => key);
};
