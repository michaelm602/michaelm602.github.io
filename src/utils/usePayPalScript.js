// src/utils/usePayPalScript.js
import { useEffect } from "react";

export default function usePayPalScript(clientId, onReady) {
    useEffect(() => {
        const scriptId = "paypal-sdk";

        if (window.paypal) {
            console.log("✅ PayPal already loaded");
            onReady();
            return;
        }

        const existingScript = document.getElementById(scriptId);
        if (existingScript) {
            existingScript.onload = () => {
                console.log("✅ PayPal SDK ready (from existing script)");
                onReady();
            };
            return;
        }

        const script = document.createElement("script");
        script.id = scriptId;
        script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&components=buttons&enable-funding=venmo`;
        script.async = true;
        script.onload = () => {
            console.log("✅ PayPal SDK loaded");
            onReady();
        };
        script.onerror = () => {
            console.error("❌ Failed to load PayPal SDK");
        };
        document.body.appendChild(script);
    }, [clientId, onReady]);
}
