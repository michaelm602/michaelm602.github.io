import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { isAdminUser } from "../utils/admin";

const INITIAL_STATE = {
  user: undefined,
  isAdmin: false,
  loading: true,
  error: "",
};

export default function useAdminAuth() {
  const [state, setState] = useState(INITIAL_STATE);

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!active) return;

      if (!user) {
        setState({ user: null, isAdmin: false, loading: false, error: "" });
        return;
      }

      setState({ user, isAdmin: false, loading: true, error: "" });

      try {
        const isAdmin = await isAdminUser(user);
        if (active) setState({ user, isAdmin, loading: false, error: "" });
      } catch (error) {
        console.error("Admin authorization check failed:", error);
        if (active) {
          setState({
            user,
            isAdmin: false,
            loading: false,
            error: "Unable to verify admin access. Please sign out and try again.",
          });
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return state;
}
