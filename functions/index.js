const functions = require("firebase-functions");
const stripe = require("stripe")(functions.config().stripe.secret);
const cors = require("cors");
const { initializeApp } = require("firebase-admin/app");

initializeApp();

const corsHandler = cors({ origin: true });

exports.createStripeCheckoutSessionLive = functions.https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
        if (req.method !== "POST") {
            return res.status(405).send("Method Not Allowed");
        }

        try {
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ["card"],
                line_items: req.body.items,
                mode: "payment",
                success_url: "https://michaelm602.github.io/#/shop?status=success",
                cancel_url: "https://michaelm602.github.io/#/shop?status=cancel",
            });

            return res.status(200).json({ url: session.url });
        } catch (error) {
            console.error("Stripe session error:", error);
            return res.status(500).send("Checkout failed.");
        }
    });
});
