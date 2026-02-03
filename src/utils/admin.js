export const ADMIN_UID = "1AWLkAfMGjgDSNik9bRsIWROGW73";
export const ADMIN_EMAIL = "airbrushnink@gmail.com";

export function isAdminUser(user) {
    if (!user) return false;
    return (
        user.uid === ADMIN_UID ||
        (user.email || "").toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim()
    );
}
