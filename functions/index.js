const functions = require("firebase-functions");
const stripe = require("stripe")(functions.config().stripe.secret); // or process.env.STRIPE_SECRET_KEY
const cors = require("cors")({ origin: true });

// force load

const { initializeApp } = require("firebase-admin/app");
initializeApp();

exports.createStripeCheckoutSessionLive = functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
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
