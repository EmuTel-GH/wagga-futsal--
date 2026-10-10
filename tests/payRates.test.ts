import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRates } from "../lib/payRates";

const ok = { fieldRefCents: 5000, scorerCents: 2500, fieldRefSeniorCents: 6000, scorerSeniorCents: 0 };

test("valid whole-cent rates pass through", () => {
  assert.deepEqual(validateRates(ok), { rates: ok });
});

test("negative, fractional, missing, non-number and huge rates are rejected", () => {
  for (const bad of [
    { ...ok, scorerCents: -1 },
    { ...ok, fieldRefCents: 50.5 },
    { ...ok, fieldRefSeniorCents: undefined },
    { ...ok, scorerSeniorCents: "2500" },
    { ...ok, fieldRefCents: NaN },
    { ...ok, fieldRefCents: 100_001 },
    null,
  ]) {
    assert.ok("error" in validateRates(bad), JSON.stringify(bad));
  }
});

test("extra fields are dropped", () => {
  assert.deepEqual(validateRates({ ...ok, orgBsb: "x" }), { rates: ok });
});
