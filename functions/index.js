const functions = require("firebase-functions");
const stripe = require("stripe")(functions.config().stripe.secret); // or hardcode test key
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

admin.initializeApp();

exports.createStripeCheckoutSessionLive = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
        // ✅ Handle OPTIONS preflight
        if (req.method === "OPTIONS") {
            res.set("Access-Control-Allow-Methods", "POST");
            res.set("Access-Control-Allow-Headers", "Content-Type");
            res.set("Access-Control-Allow-Origin", "*");
            res.status(204).send('');
            return;
        }

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
});
