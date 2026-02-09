// src/utils/usePayPalScript.js
import { useEffect, useRef } from "react";

export default function usePayPalScript(clientId, onReady) {
    const onReadyRef = useRef(onReady);

    // keep latest callback without retriggering the script loader effect
    useEffect(() => {
        onReadyRef.current = onReady;
    }, [onReady]);

    useEffect(() => {
        if (!clientId) return;

        const scriptId = "paypal-sdk";
        const callReady = () => {
            if (typeof onReadyRef.current === "function") {
                onReadyRef.current();
            }
        };

        // Already loaded
        if (window.paypal) {
            console.log("✅ PayPal already loaded");
            callReady();
            return;
        }

        // Script tag already exists
        const existingScript = document.getElementById(scriptId);
        if (existingScript) {
            existingScript.addEventListener("load", callReady, { once: true });
            return;
        }

        // Create script
        const script = document.createElement("script");
        script.id = scriptId;
        script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&components=buttons&enable-funding=venmo`;
        script.async = true;

        script.addEventListener("load", () => {
            console.log("✅ PayPal SDK loaded");
            callReady();
        });

        script.addEventListener("error", () => {
            console.error("❌ Failed to load PayPal SDK");
        });

        document.body.appendChild(script);

        // optional cleanup (leave script in place usually)
        // return () => script.remove();
    }, [clientId]);
}
