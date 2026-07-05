import { isAdminUser } from "./admin.js";

export async function authorizeAdminLogin(user, signOutCurrentUser, verifyAdmin = isAdminUser) {
  const authorized = await verifyAdmin(user);
  if (!authorized) await signOutCurrentUser();
  return authorized;
}

export function getLoginErrorMessage(error) {
  switch (error?.code) {
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "The email or password is incorrect.";
    case "auth/too-many-requests":
      return "Too many login attempts. Please wait a moment and try again.";
    case "auth/network-request-failed":
      return "Unable to reach Firebase. Check your connection and try again.";
    default:
      return "Login failed. Please try again.";
  }
}
