/** Canonical runtime shape guards for data crossing the persistence boundary. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
