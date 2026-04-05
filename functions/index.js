/**
 * functions/index.js
 * - Gen 2 HTTPS: createStripeCheckoutSession
 * - Gen 2 Storage: generateImageVariants (full .webp + __thumb.webp)
 *
 * Requirements:
 * - functions/package.json engines.node = "20" (you already did)
 * - deps: firebase-admin, firebase-functions, stripe, sharp, cors (you already have)
 *
 * firebase.json:
 * - REMOVE runtime nodejs18
 * - REMOVE entryPoint (so both functions deploy)
 */

const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");

const { setGlobalOptions } = require("firebase-functions/v2");
const { onRequest } = require("firebase-functions/v2/https");
const { onObjectFinalized } = require("firebase-functions/v2/storage");
const { defineSecret } = require("firebase-functions/params");

const cors = require("cors");
const Stripe = require("stripe");

const path = require("path");
const os = require("os");
const fs = require("fs/promises");
const sharp = require("sharp");

// ----- Init -----
if (!admin.apps.length) admin.initializeApp();

// Keep everything in one region
setGlobalOptions({ region: "us-central1" });

// ----- CORS -----
// Add any domains you want to allow.
const ALLOWED_ORIGINS = new Set([
    "https://www.likwitblvd.com",
    "http://localhost:5173",
    "http://localhost:4173",
]);

const corsHandler = cors({
    origin: (origin, cb) => {
        // Allow curl/postman/no-origin
        if (!origin) return cb(null, true);
        if (ALLOWED_ORIGINS.has(origin)) return cb(null, true);
        return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
});

// ----- Stripe Secret (Gen 2 / Secret Manager) -----
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

function getStripe(secret) {
    return new Stripe(secret);
}

// =============================
// 1) STRIPE CHECKOUT (Gen 2)
// =============================
exports.createStripeCheckoutSession = onRequest(
    { secrets: [stripeSecretKey] },
    async (req, res) => {
        corsHandler(req, res, async () => {
            try {
                if (req.method === "OPTIONS") {
                    return res.status(204).send("");
                }

                if (req.method !== "POST") {
                    return res.status(405).json({ error: "Method not allowed. Use POST." });
                }

                const secret = stripeSecretKey.value();
                if (!secret) {
                    return res.status(500).json({
                        error: "Stripe is not configured. STRIPE_SECRET_KEY secret is missing.",
                    });
                }

                const stripe = getStripe(secret);

                const body = req.body || {};
                const lineItems = body.lineItems;
                const cartItems = body.cartItems || [];
                const orderTotal = body.orderTotal || 0;
                const successUrl = body.successUrl;
                const cancelUrl = body.cancelUrl;
                const mode = body.mode || "payment";

                if (!Array.isArray(lineItems) || lineItems.length === 0) {
                    return res.status(400).json({ error: "Missing lineItems array." });
                }
                if (!successUrl || !cancelUrl) {
                    return res.status(400).json({ error: "Missing successUrl/cancelUrl." });
                }

                // Create pending order in Firestore (admin SDK bypasses security rules)
                const orderRef = await admin.firestore().collection("orders").add({
                    cartItems,
                    buyerInfo: {},
                    status: "pending",
                    paymentProvider: "stripe",
                    paymentStatus: "pending",
                    orderTotal,
                    currency: "USD",
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                const orderId = orderRef.id;

                const session = await stripe.checkout.sessions.create({
                    mode,
                    line_items: lineItems,
                    success_url: `${successUrl}&orderId=${orderId}`,
                    cancel_url: `${cancelUrl}&orderId=${orderId}`,
                    client_reference_id: orderId,
                    metadata: { orderId },
                });

                return res.status(200).json({ id: session.id, url: session.url, orderId });
            } catch (err) {
                logger.error("Stripe session error", {
                    message: err?.message,
                    type: err?.type,
                    code: err?.code,
                    statusCode: err?.statusCode,
                });
                return res.status(500).json({
                    error: err?.message || "Failed to create Stripe Checkout session",
                });
            }
        });
    }
);

// ===========================================
// 2) STRIPE WEBHOOK (Gen 2 / HTTPS)
// ===========================================
exports.handleStripeWebhook = onRequest(
    { secrets: [stripeSecretKey, stripeWebhookSecret] },
    async (req, res) => {
        if (req.method !== "POST") {
            return res.status(405).json({ error: "Method not allowed. Use POST." });
        }

        try {
            const stripeSecret = stripeSecretKey.value();
            const webhookSecret = stripeWebhookSecret.value();
            const signature = req.get("stripe-signature");

            if (!stripeSecret || !webhookSecret) {
                return res.status(500).json({
                    error: "Stripe webhook is not configured. Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET.",
                });
            }

            if (!signature) {
                return res.status(400).json({ error: "Missing Stripe signature." });
            }

            const stripe = getStripe(stripeSecret);
            const event = stripe.webhooks.constructEvent(req.rawBody, signature, webhookSecret);

            if (event.type === "checkout.session.completed") {
                const session = event.data.object;
                const orderId = session.metadata?.orderId || session.client_reference_id;

                if (orderId) {
                    await admin.firestore().collection("orders").doc(orderId).set(
                        {
                            status: "paid",
                            paymentProvider: "stripe",
                            paymentStatus: "paid",
                            stripeSessionId: session.id,
                            stripePaymentIntentId: session.payment_intent || null,
                            stripeCustomerId: session.customer || null,
                            stripeCustomerEmail: session.customer_details?.email || null,
                            stripePaymentStatus: session.payment_status || null,
                            paidAt: admin.firestore.FieldValue.serverTimestamp(),
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        },
                        { merge: true }
                    );
                }
            }

            if (event.type === "checkout.session.expired") {
                const session = event.data.object;
                const orderId = session.metadata?.orderId || session.client_reference_id;

                if (orderId) {
                    await admin.firestore().collection("orders").doc(orderId).set(
                        {
                            status: "cancelled",
                            paymentProvider: "stripe",
                            paymentStatus: "expired",
                            stripeSessionId: session.id,
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        },
                        { merge: true }
                    );
                }
            }

            return res.status(200).json({ received: true });
        } catch (err) {
            logger.error("Stripe webhook error", {
                message: err?.message,
                type: err?.type,
                code: err?.code,
                statusCode: err?.statusCode,
            });

            return res.status(400).json({
                error: err?.message || "Stripe webhook processing failed",
            });
        }
    }
);

// ===========================================
// 3) AUTO IMAGE VARIANTS (Gen 2 / Storage)
// ===========================================
const FULL_MAX_WIDTH = 1600; // lightbox
const THUMB_MAX_WIDTH = 600; // grid
const WEBP_QUALITY = 78;

function isProcessableImage(contentType, filePath) {
    if (!contentType || !contentType.startsWith("image/")) return false;

    const ext = path.extname(filePath).toLowerCase();
    if (![".jpg", ".jpeg", ".png"].includes(ext)) return false;

    const base = path.basename(filePath, ext);
    if (base.endsWith("__thumb")) return false;

    // Also skip if someone manually uploads webp
    if (ext === ".webp") return false;

    return true;
}

exports.generateImageVariants = onObjectFinalized(async (event) => {
    const object = event.data;
    const filePath = object.name;
    const contentType = object.contentType;

    if (!filePath) return;

    if (!isProcessableImage(contentType, filePath)) {
        logger.info("Skipping:", { filePath, contentType });
        return;
    }

    const bucket = admin.storage().bucket(object.bucket);

    const dir = path.posix.dirname(filePath);
    const ext = path.extname(filePath);
    const baseName = path.basename(filePath, ext);

    const fullWebpPath = path.posix.join(dir, `${baseName}.webp`);
    const thumbWebpPath = path.posix.join(dir, `${baseName}__thumb.webp`);

    // Skip if already exists
    const [fullExists] = await bucket.file(fullWebpPath).exists();
    const [thumbExists] = await bucket.file(thumbWebpPath).exists();
    if (fullExists && thumbExists) {
        logger.info("Variants exist, skipping:", { filePath });
        return;
    }

    const tempOriginal = path.join(os.tmpdir(), path.basename(filePath));
    const tempFull = path.join(os.tmpdir(), `${baseName}.webp`);
    const tempThumb = path.join(os.tmpdir(), `${baseName}__thumb.webp`);

    // Download original
    await bucket.file(filePath).download({ destination: tempOriginal });
    const inputBuffer = await fs.readFile(tempOriginal);

    // Full WebP
    if (!fullExists) {
        await sharp(inputBuffer, { failOn: "none" })
            .rotate()
            .resize({ width: FULL_MAX_WIDTH, withoutEnlargement: true })
            .webp({ quality: WEBP_QUALITY, effort: 5 })
            .toFile(tempFull);

        await bucket.upload(tempFull, {
            destination: fullWebpPath,
            metadata: {
                contentType: "image/webp",
                cacheControl: "public,max-age=31536000,immutable",
            },
        });

        logger.info("Uploaded full webp:", { fullWebpPath });
    }

    // Thumb WebP
    if (!thumbExists) {
        await sharp(inputBuffer, { failOn: "none" })
            .rotate()
            .resize({ width: THUMB_MAX_WIDTH, withoutEnlargement: true })
            .webp({ quality: WEBP_QUALITY, effort: 5 })
            .toFile(tempThumb);

        await bucket.upload(tempThumb, {
            destination: thumbWebpPath,
            metadata: {
                contentType: "image/webp",
                cacheControl: "public,max-age=31536000,immutable",
            },
        });

        logger.info("Uploaded thumb webp:", { thumbWebpPath });
    }

    // Cleanup temp files
    await Promise.allSettled([
        fs.unlink(tempOriginal),
        fs.unlink(tempFull),
        fs.unlink(tempThumb),
    ]);

    logger.info("Done:", { filePath });
});
