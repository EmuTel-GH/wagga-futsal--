/** Referee game fees, in whole cents. Upper bound guards against typos (e.g. 50000 for $50). */
export const MAX_RATE_CENTS = 100_000;

export const RATE_FIELDS = ["fieldRefCents", "scorerCents", "fieldRefSeniorCents", "scorerSeniorCents"] as const;
export type Rates = Record<(typeof RATE_FIELDS)[number], number>;

export function validateRates(body: unknown): { rates: Rates } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const rates = {} as Rates;
  for (const key of RATE_FIELDS) {
    const v = b[key];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > MAX_RATE_CENTS) {
      return { error: "Each rate must be a dollar amount between $0 and $1,000" };
    }
    rates[key] = v;
  }
  return { rates };
}
