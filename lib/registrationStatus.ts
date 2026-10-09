/**
 * What a player's PlayFootball registration means for us, from the raw
 * "Reg Status" and "Payment Status" saved at import. PlayFootball's export
 * (checked against Sam's 9 Oct 2026 file) uses:
 *   Reg Status:     Approved | AwaitingApproval
 *   Payment Status: PaidInFull | Unpaid | PaidRegFeesOnly | RefundProvided | RefundRequested
 * Other wording is matched generously; the raw text is always shown on hover.
 * No status at all = imported before statuses were kept: plain "registered".
 */
export type RegistrationState = "REGISTERED" | "PART_PAID" | "UNPAID" | "PENDING" | "WITHDRAWN" | "UNKNOWN";

const WITHDRAWN = /cancel|declin|withdr|refund|deregist|inactive|expired|reject|void/i;
// Paid the FA/state regulation fees but not the club's fee.
const PART_PAID = /regfeesonly|reg fees only|paidreg|part(ial)?(ly)? ?paid/i;
const UNPAID = /unpaid|not paid|no payment|awaiting payment|payment (pending|due|required|outstanding|failed)|owing|outstanding|balance|part(ial)?(ly)? paid|failed/i;
const PENDING = /pending|incomplete|in progress|draft|submitted|awaiting|review|unverified|unconfirmed|not (yet )?(registered|complete)/i;
const PAID_FIELD_NO = /^(no|n|false|0|unpaid|not paid)$/i;

export function registrationState(status: string | null | undefined, payment?: string | null): RegistrationState {
  const s = (status ?? "").trim();
  const p = (payment ?? "").trim();
  if (!s && !p) return "UNKNOWN";
  if (WITHDRAWN.test(s) || WITHDRAWN.test(p)) return "WITHDRAWN";
  if (PART_PAID.test(p) || PART_PAID.test(s)) return "PART_PAID";
  if (UNPAID.test(s) || (p && (UNPAID.test(p) || PAID_FIELD_NO.test(p) || PENDING.test(p)))) return "UNPAID";
  if (PENDING.test(s)) return "PENDING";
  return "REGISTERED";
}

export const REGISTRATION_LABEL: Record<RegistrationState, string> = {
  REGISTERED: "registered",
  PART_PAID: "club fee unpaid",
  UNPAID: "unpaid",
  PENDING: "awaiting approval",
  WITHDRAWN: "withdrawn",
  UNKNOWN: "registered",
};

/** True when the registration isn't complete (worth flagging in the UI). */
export const isProblem = (s: RegistrationState) => s === "UNPAID" || s === "PART_PAID" || s === "PENDING" || s === "WITHDRAWN";
