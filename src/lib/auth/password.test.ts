import { test } from "node:test";
import assert from "node:assert/strict";

import { hashPassword, verifyPassword } from "./password";

test("the right password verifies and the wrong one does not", async () => {
  const stored = await hashPassword("corect horse");
  assert.equal(await verifyPassword("corect horse", stored), true);
  assert.equal(await verifyPassword("corect hors", stored), false);
});

test("the same password hashes differently each time (salted)", async () => {
  assert.notEqual(await hashPassword("parola123"), await hashPassword("parola123"));
});

test("a malformed stored hash never verifies", async () => {
  assert.equal(await verifyPassword("x", ""), false);
  assert.equal(await verifyPassword("x", "bcrypt$whatever"), false);
});
