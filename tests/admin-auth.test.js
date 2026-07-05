import test from "node:test";
import assert from "node:assert/strict";
import { hasAdminClaim, isAdminUser } from "../src/utils/admin.js";
import { authorizeAdminLogin, getLoginErrorMessage } from "../src/utils/login.js";

test("admin authorization requires an explicit true custom claim", async () => {
  assert.equal(hasAdminClaim({ claims: { admin: true } }), true);
  assert.equal(hasAdminClaim({ claims: { admin: false } }), false);
  assert.equal(hasAdminClaim({ claims: {} }), false);

  let receivedForceRefresh;
  const user = {
    getIdTokenResult: async (forceRefresh) => {
      receivedForceRefresh = forceRefresh;
      return { claims: { admin: true } };
    },
  };

  assert.equal(await isAdminUser(user, true), true);
  assert.equal(receivedForceRefresh, true);
  assert.equal(await isAdminUser(null), false);
});

test("unauthorized login signs the Firebase user back out", async () => {
  let signedOut = false;
  const authorized = await authorizeAdminLogin(
    { uid: "not-admin" },
    async () => { signedOut = true; },
    async () => false
  );

  assert.equal(authorized, false);
  assert.equal(signedOut, true);
});

test("authorized login leaves the Firebase session active", async () => {
  let signedOut = false;
  const authorized = await authorizeAdminLogin(
    { uid: "admin" },
    async () => { signedOut = true; },
    async () => true
  );

  assert.equal(authorized, true);
  assert.equal(signedOut, false);
});

test("Firebase login errors retain useful user-facing detail", () => {
  assert.equal(
    getLoginErrorMessage({ code: "auth/invalid-credential" }),
    "The email or password is incorrect."
  );
  assert.match(
    getLoginErrorMessage({ code: "auth/too-many-requests" }),
    /Too many login attempts/
  );
});
