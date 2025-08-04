const functions = require("firebase-functions");
const stripe = require("stripe")(functions.config().stripe.secret); // or your actual secret key
const admin = require("firebase-admin");

admin.initializeApp();

// force redeploy


exports.createStripeCheckoutSessionLive = functions.https.onRequest(async (req, res) => {
    // ✅ Set CORS headers manually
    res.set("Access-Control-Allow-Origin", "https://www.likwitblvd.com");
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    // ✅ Handle preflight OPTIONS request
    if (req.method === "OPTIONS") {
        return res.status(204).send('');
    }

    // ✅ Reject non-POST methods
    if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed");
    }

    try {
        const { items } = req.body;

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ["card"],
            line_items: items,
            mode: "payment",
            success_url: "https://www.likwitblvd.com/#/shop?status=success",
            cancel_url: "https://www.likwitblvd.com/#/shop?status=cancel",
        });

        return res.status(200).json({ url: session.url });
    } catch (error) {
        console.error("Stripe session error:", error);
        return res.status(500).send(`Error: ${error.message}`);
    }
});
