// src/utils/usePayPalScript.js
import { useEffect } from "react";

export default function usePayPalScript(clientId) {
    useEffect(() => {
        const scriptId = "paypal-sdk";

        if (document.getElementById(scriptId)) return;

        const script = document.createElement("script");
        script.id = scriptId;
        script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD&components=buttons&enable-funding=venmo`;
        script.async = true;
        document.body.appendChild(script);
    }, [clientId]);
}
