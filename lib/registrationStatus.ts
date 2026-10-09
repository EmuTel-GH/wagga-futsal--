/**
 * What a player's PlayFootball registration means for us, from the raw
 * "Registration status" (and payment status, when the export has one) saved
 * at import. The wording isn't documented, so match generously; the raw text
 * is always shown alongside. No status at all = imported before statuses were
 * kept, shown as plain "registered" as before.
 */
export type RegistrationState = "REGISTERED" | "UNPAID" | "PENDING" | "WITHDRAWN" | "UNKNOWN";

const WITHDRAWN = /cancel|declin|withdr|refund|deregist|inactive|expired|reject|void/i;
const UNPAID = /unpaid|not paid|no payment|awaiting payment|payment (pending|due|required|outstanding|failed)|owing|outstanding|balance|part(ial)?(ly)? paid|failed/i;
const PENDING = /pending|incomplete|in progress|draft|submitted|awaiting|review|unverified|unconfirmed|not (yet )?(registered|complete)/i;
const PAID_FIELD_NO = /^(no|n|false|0|unpaid|not paid)$/i;

export function registrationState(status: string | null | undefined, payment?: string | null): RegistrationState {
  const s = (status ?? "").trim();
  const p = (payment ?? "").trim();
  if (!s && !p) return "UNKNOWN";
  if (WITHDRAWN.test(s)) return "WITHDRAWN";
  if (UNPAID.test(s) || (p && (UNPAID.test(p) || PAID_FIELD_NO.test(p) || PENDING.test(p)))) return "UNPAID";
  if (PENDING.test(s)) return "PENDING";
  return "REGISTERED";
}

export const REGISTRATION_LABEL: Record<RegistrationState, string> = {
  REGISTERED: "registered",
  UNPAID: "unpaid",
  PENDING: "registration incomplete",
  WITHDRAWN: "withdrawn",
  UNKNOWN: "registered",
};

/** True when the registration isn't complete (worth flagging in the UI). */
export const isProblem = (s: RegistrationState) => s === "UNPAID" || s === "PENDING" || s === "WITHDRAWN";
