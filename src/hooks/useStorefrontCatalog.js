import { useCallback, useEffect, useState } from "react";
import { loadStorefrontCatalog } from "../services/storefrontProducts";

export default function useStorefrontCatalog(channel = "shop") {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ products: [], loading: true, error: null });

  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  useEffect(() => {
    let alive = true;
    setState({ products: [], loading: true, error: null });

    loadStorefrontCatalog({ channel })
      .then((products) => {
        if (alive) setState({ products, loading: false, error: null });
      })
      .catch((error) => {
        console.error("Unable to load storefront catalog:", error);
        if (alive) setState({ products: [], loading: false, error });
      });

    return () => {
      alive = false;
    };
  }, [attempt, channel]);

  return { ...state, retry };
}
