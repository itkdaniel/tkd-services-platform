/**
 * Drizzle returns `Date` objects for timestamp columns, but the OpenAPI
 * contract (and therefore every generated Zod response schema) models
 * timestamps as ISO strings. Round-tripping through JSON converts every
 * `Date` to its ISO string the same way `res.json()` would, so schema
 * validation and the actual wire format always agree.
 */
export function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
