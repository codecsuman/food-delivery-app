/**
 * Shared identifier helpers.
 *
 * MongoDB ObjectIds are exactly 24 hexadecimal characters. Checking only the
 * length (the previous client guard) let values like
 * "not-an-object-id-xxxxxx" through to the API, which then answered 400.
 */
const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

export const isValidObjectId = (value: unknown): value is string =>
  typeof value === "string" && OBJECT_ID_PATTERN.test(value);

/** Restaurant references may arrive populated (object) or as a raw id. */
export const getRestaurantId = (
  restaurant: string | { _id?: string } | null | undefined,
): string | null => {
  const candidate =
    typeof restaurant === "string"
      ? restaurant.trim()
      : restaurant && typeof restaurant === "object"
        ? typeof restaurant._id === "string"
          ? restaurant._id.trim()
          : null
        : null;

  return candidate && OBJECT_ID_PATTERN.test(candidate) ? candidate : null;
};
