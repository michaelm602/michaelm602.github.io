"use strict";

const { applicationDefault, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

const BOOTSTRAP_ADMIN_EMAIL = "airbrushnink@gmail.com";
const BOOTSTRAP_ADMIN_UID = "1AWLkAfMGjgDSNik9bRsIWROGW73";

function readOption(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

async function main() {
  const email = readOption("--email");
  const uid = readOption("--uid");
  const projectId = readOption("--project-id") || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;

  if (email && uid) throw new Error("Pass either --email or --uid, not both.");

  const lookupEmail = email || (!uid ? BOOTSTRAP_ADMIN_EMAIL : null);
  const lookupUid = uid || null;

  initializeApp({
    credential: applicationDefault(),
    ...(projectId ? { projectId } : {}),
  });

  const auth = getAuth();
  const user = lookupUid
    ? await auth.getUser(lookupUid)
    : await auth.getUserByEmail(lookupEmail);

  if (!email && !uid && user.uid !== BOOTSTRAP_ADMIN_UID) {
    throw new Error(
      `Default admin UID mismatch. Expected ${BOOTSTRAP_ADMIN_UID}, found ${user.uid}. Pass --email or --uid explicitly after verifying the account.`
    );
  }

  await auth.setCustomUserClaims(user.uid, {
    ...(user.customClaims || {}),
    admin: true,
  });

  const updatedUser = await auth.getUser(user.uid);
  console.log("Admin claim assigned successfully.");
  console.log(`UID: ${updatedUser.uid}`);
  console.log(`Email: ${updatedUser.email || "(none)"}`);
  console.log(`admin: ${updatedUser.customClaims?.admin === true}`);
  console.log("The user must sign out and sign back in to receive a token containing the new claim.");
}

main().catch((error) => {
  console.error(`Unable to assign admin claim: ${error.message}`);
  process.exitCode = 1;
});
