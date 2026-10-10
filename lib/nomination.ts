/**
 * Validation for the public team nomination form: every field must be the
 * right type and a sensible length, and the email must look real. Returns a
 * message for the person filling it in, or null if it's fine.
 */
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[A-Za-z]{2,24}$/;
const PHONE = /^[0-9+()\-\s]{6,20}$/;

type Input = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : null);

export function validateNomination(b: Input): string | null {
  const required: [string, string, number][] = [["teamName", "Team name", 60], ["competitionId", "Competition", 40], ["contactName", "Contact name", 80], ["contactEmail", "Contact email", 254]];
  const optional: [string, string, number][] = [["contactPhone", "Phone", 20], ["kitShirt", "Shirt colour", 40], ["kitShorts", "Shorts colour", 40], ["kitSocks", "Socks colour", 40]];
  for (const [k, label, max] of required) {
    const v = str(b[k]);
    if (v === null || v === "") return `${label} is required`;
    if (v.length > max) return `${label} is too long`;
  }
  for (const [k, label, max] of optional) {
    const v = str(b[k]);
    if (v === null) return `${label} is invalid`;
    if (v.length > max) return `${label} is too long`;
  }
  if (!EMAIL.test(str(b.contactEmail) as string)) return "Please enter a valid email address";
  const phone = str(b.contactPhone) as string;
  if (phone && !PHONE.test(phone)) return "Please enter a valid phone number";
  const players = str(b.players);
  if (players === null) return "Players list is invalid";
  if (players.length > 2000) return "Players list is too long";
  if (players.split("\n").some((l) => l.trim().length > 60)) return "Each player's name must be under 60 characters";
  return null;
}
