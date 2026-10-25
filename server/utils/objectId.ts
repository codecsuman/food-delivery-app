/**
 * Strict MongoDB ObjectId check.
 *
 * `mongoose.Types.ObjectId.isValid()` also accepts any 12-byte string
 * (for example "123456789012"), which is not a real 24-character hex
 * ObjectId. Using an explicit pattern keeps the API contract unambiguous:
 *
 *   malformed id  -> 400 Bad Request
 *   valid, absent -> 404 Not Found
 */
const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

export const isValidObjectId = (value: unknown): value is string =>
  typeof value === "string" && OBJECT_ID_PATTERN.test(value);
