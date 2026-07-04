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
const { buildTrustedCheckout } = require("./stripeCatalog");

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
const emailjsPublicKey = defineSecret("EMAILJS_PUBLIC_KEY");

const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || "service_6j3le5o";
const EMAILJS_STRIPE_CUSTOMER_TEMPLATE_ID =
    process.env.EMAILJS_STRIPE_CUSTOMER_TEMPLATE_ID || "template_dxmzwa3";
const EMAIL_SEND_CLAIM_TTL_MS = 10 * 60 * 1000;

function getStripe(secret) {
    return new Stripe(secret);
}

function money(value, currency = "USD") {
    const amount = Number(value) || 0;
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
    }).format(amount);
}

function normalizeOrderItems(cartItems = []) {
    if (!Array.isArray(cartItems)) return [];

    return cartItems.map((item) => {
        const quantity = Number(item.quantity) || 1;
        const unitPrice = Number(item.unitPrice ?? item.price) || 0;

        return {
            productId: item.productId || null,
            title: item.title || "Untitled artwork",
            size: item.size || "Selected size",
            quantity,
            unitPrice,
            lineTotal: unitPrice * quantity,
            image: item.image || null,
        };
    });
}

function buildItemsText(items = [], currency = "USD") {
    if (!items.length) return "Order items are listed in Firestore.";

    return items
        .map((item) => {
            return `${item.quantity} x ${item.title} (${item.size}) - ${money(
                item.lineTotal,
                currency
            )}`;
        })
        .join("\n");
}

function buildEmailParams({ orderId, order, session, customer, items, eventId }) {
    const currency = (order.currency || "USD").toUpperCase();
    const orderTotal =
        Number(order.orderTotal) ||
        items.reduce((sum, item) => sum + item.lineTotal, 0);
    const itemsText = buildItemsText(items, currency);
    const orderPath = `orders/${orderId}`;

    return {
        order_id: orderId,
        order_path: orderPath,
        firestore_order_path: orderPath,
        customer_name: customer.name || "Customer",
        customer_email: customer.email || "",
        to_name: customer.name || "Customer",
        to_email: customer.email || "",
        orders: items.map((item) => ({
            name: `${item.title} - ${item.size}`,
            title: item.title,
            size: item.size,
            units: item.quantity,
            quantity: item.quantity,
            unit_price: money(item.unitPrice, currency),
            price: money(item.lineTotal, currency),
            line_total: money(item.lineTotal, currency),
            image_url: item.image || "",
        })),
        items_text: itemsText,
        item_count: items.reduce((sum, item) => sum + item.quantity, 0),
        order_total: money(orderTotal, currency),
        total: money(orderTotal, currency),
        currency,
        payment_provider: "Stripe",
        payment_status: session.payment_status || "paid",
        stripe_session_id: session.id,
        stripe_payment_intent_id: session.payment_intent || "",
        stripe_customer_id: session.customer || "",
        stripe_event_id: eventId,
        message:
            "A paid Stripe order was confirmed. Fulfillment can begin after reviewing the Firestore order record.",
        cost: {
            shipping: money(0, currency),
            tax: money(0, currency),
            total: money(orderTotal, currency),
        },
    };
}

async function sendEmailjsTemplate(templateId, templateParams) {
    const publicKey = emailjsPublicKey.value();

    if (!EMAILJS_SERVICE_ID || !templateId || !publicKey) {
        throw new Error("EmailJS is missing service ID, template ID, or public key.");
    }

    const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            service_id: EMAILJS_SERVICE_ID,
            template_id: templateId,
            user_id: publicKey,
            template_params: templateParams,
        }),
    });

    const text = await response.text();
    if (!response.ok) {
        throw new Error(`EmailJS send failed (${response.status}): ${text}`);
    }

    return { status: response.status, text };
}

async function claimEmailSend(orderRef, sentField, eventId) {
    const sendingField = `${sentField}Sending`;
    const startedMsField = `${sentField}SendingStartedMs`;
    const eventField = `${sentField}EventId`;
    const nowMs = Date.now();

    return admin.firestore().runTransaction(async (transaction) => {
        const snap = await transaction.get(orderRef);
        const data = snap.exists ? snap.data() : {};

        if (data?.[sentField]) return false;

        const startedMs = Number(data?.[startedMsField]) || 0;
        const isFreshClaim =
            data?.[sendingField] && startedMs && nowMs - startedMs < EMAIL_SEND_CLAIM_TTL_MS;

        if (isFreshClaim) return false;

        transaction.set(
            orderRef,
            {
                [sendingField]: true,
                [startedMsField]: nowMs,
                [eventField]: eventId,
                emailStatus: "sending",
                emailLastEventId: eventId,
                emailUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );

        return true;
    });
}

async function markEmailSendComplete(orderRef, sentField, result) {
    await orderRef.set(
        {
            [sentField]: true,
            [`${sentField}Sending`]: false,
            [`${sentField}SentAt`]: admin.firestore.FieldValue.serverTimestamp(),
            [`${sentField}Result`]: result,
            [`${sentField}Error`]: admin.firestore.FieldValue.delete(),
            emailStatus: "sent",
            emailUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
    );
}

async function markEmailSendFailed(orderRef, sentField, error) {
    await orderRef.set(
        {
            [`${sentField}Sending`]: false,
            [`${sentField}Error`]: error?.message || String(error),
            [`${sentField}FailedAt`]: admin.firestore.FieldValue.serverTimestamp(),
            emailStatus: "failed",
            emailUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
    );
}

async function sendClaimedEmail({ orderRef, sentField, templateId, params }) {
    try {
        const result = await sendEmailjsTemplate(templateId, params);
        await markEmailSendComplete(orderRef, sentField, result);
        return result;
    } catch (error) {
        await markEmailSendFailed(orderRef, sentField, error);
        throw error;
    }
}

async function sendStripeOrderEmails({ orderRef, orderId, session, eventId }) {
    const orderSnap = await orderRef.get();
    const order = orderSnap.exists ? orderSnap.data() : {};
    const customer = {
        name:
            session.customer_details?.name ||
            order.buyerInfo?.name ||
            "Customer",
        email:
            session.customer_details?.email ||
            order.stripeCustomerEmail ||
            order.buyerInfo?.email ||
            "",
    };
    const items = normalizeOrderItems(order.cartItems);
    const params = buildEmailParams({ orderId, order, session, customer, items, eventId });

    if (!EMAILJS_STRIPE_CUSTOMER_TEMPLATE_ID) {
        await orderRef.set(
            {
                emailStatus: "config_missing",
                emailConfigError:
                    "Missing EMAILJS_STRIPE_CUSTOMER_TEMPLATE_ID.",
                emailUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );
        logger.warn("Stripe order email skipped due to missing EmailJS template config", {
            orderId,
        });
        return;
    }

    const customerClaimed =
        Boolean(customer.email) &&
        (await claimEmailSend(orderRef, "customerEmailSent", eventId));

    if (customerClaimed) {
        await sendClaimedEmail({
            orderRef,
            sentField: "customerEmailSent",
            templateId: EMAILJS_STRIPE_CUSTOMER_TEMPLATE_ID,
            params: {
                ...params,
                message:
                    "Thank you for your Likwit Blvd order. Your payment is confirmed, your order has been received, and we will contact you if any fulfillment details are needed.",
            },
        });
    } else if (!customer.email) {
        await orderRef.set(
            {
                customerEmailSkipped: true,
                customerEmailError: "Stripe checkout session did not include a customer email.",
                emailUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );
    }

    if (customerClaimed) {
        await orderRef.set(
            {
                ownerEmailSent: true,
                ownerEmailSentVia: "customer_template_cc",
                ownerEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
        );
    }
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
                // Accept legacy cartItems during rollout, but never trust its
                // title, price, total, image, or Stripe Price values.
                const requestedItems = body.items || body.cartItems || [];
                const successUrl = body.successUrl;
                const cancelUrl = body.cancelUrl;

                if (!successUrl || !cancelUrl) {
                    return res.status(400).json({ error: "Missing successUrl/cancelUrl." });
                }

                const {
                    lineItems,
                    cartItems,
                    orderTotal,
                    currency,
                } = await buildTrustedCheckout({
                    items: requestedItems,
                    stripe,
                });

                // Create pending order in Firestore (admin SDK bypasses security rules)
                const orderRef = await admin.firestore().collection("orders").add({
                    cartItems,
                    buyerInfo: {},
                    status: "pending",
                    paymentProvider: "stripe",
                    paymentStatus: "pending",
                    orderTotal,
                    currency,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                const orderId = orderRef.id;

                const session = await stripe.checkout.sessions.create({
                    mode: "payment",
                    line_items: lineItems,
                    success_url: `${successUrl}&orderId=${orderId}`,
                    cancel_url: `${cancelUrl}&orderId=${orderId}`,
                    client_reference_id: orderId,
                    metadata: { orderId },
                });

                return res.status(200).json({ id: session.id, url: session.url, orderId });
            } catch (err) {
                const statusCode = err?.statusCode === 400 ? 400 : 500;
                const logContext = {
                    message: err?.message,
                    type: err?.type,
                    code: err?.code,
                    statusCode,
                    details: err?.details || null,
                };

                if (statusCode === 400) {
                    logger.warn("Stripe checkout request rejected", logContext);
                } else {
                    logger.error("Stripe session error", logContext);
                }

                return res.status(statusCode).json({
                    error:
                        statusCode === 400
                            ? err.message
                            : "Checkout is temporarily unavailable. Please try again.",
                });
            }
        });
    }
);

// ===========================================
// 2) STRIPE WEBHOOK (Gen 2 / HTTPS)
// ===========================================
exports.handleStripeWebhook = onRequest(
    { secrets: [stripeSecretKey, stripeWebhookSecret, emailjsPublicKey] },
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
                    const orderRef = admin.firestore().collection("orders").doc(orderId);

                    await orderRef.set(
                        {
                            buyerInfo: {
                                name: session.customer_details?.name || null,
                                email: session.customer_details?.email || null,
                            },
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

                    await sendStripeOrderEmails({
                        orderRef,
                        orderId,
                        session,
                        eventId: event.id,
                    });
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
