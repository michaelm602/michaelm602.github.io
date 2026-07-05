export const ADMIN_CLAIM = "admin";

export function hasAdminClaim(tokenResult) {
    return tokenResult?.claims?.[ADMIN_CLAIM] === true;
}

export async function isAdminUser(user, forceRefresh = false) {
    if (!user || typeof user.getIdTokenResult !== "function") return false;

    const tokenResult = await user.getIdTokenResult(forceRefresh);
    return hasAdminClaim(tokenResult);
}
