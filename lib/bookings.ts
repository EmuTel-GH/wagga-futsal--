/**
 * Online session booking (Stripe) is off until the club sets Stripe up and
 * the server sets BOOKINGS_ENABLED=true. Until then the booking and webhook
 * routes answer 404 and the session page says booking isn't open.
 */
export function bookingsEnabled() {
  return process.env.BOOKINGS_ENABLED === "true";
}
