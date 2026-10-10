import { test } from "node:test";
import assert from "node:assert/strict";
import { esc } from "../lib/ics";

const BS = "\\"; // one backslash

test("ics text escaping follows RFC 5545", () => {
  assert.equal(esc("a;b"), `a${BS};b`);
  assert.equal(esc("a,b"), `a${BS},b`);
  assert.equal(esc(`a${BS}b`), `a${BS}${BS}b`);
  assert.equal(esc("a\r\nb\nc\rd"), `a${BS}nb${BS}nc${BS}nd`);
  assert.ok(!/[\r\n]/.test(esc("x\ry\nz")), "no raw line breaks survive");
});
