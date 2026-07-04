"use strict";

const MAX_CART_LINES = 20;
const MAX_ITEM_QUANTITY = 10;
const CHECKOUT_CURRENCY = "usd";

// This catalog is deployed with the function and is the server-side allowlist.
// Browser-provided titles, prices, totals, and Stripe Price IDs are never used.
const STRIPE_CATALOG = Object.freeze({
    "adoration-in-the-lights-darkness": {
        title: "Adoration in the lights darkness",
        sizes: {
            "16x20": "price_1Rr1y0JEVsglohuhBAH3v1Hm",
            "18x24": "price_1Rr2RvJEVsglohuhe4npKcRX",
            "24x36": "price_1Rr2V9JEVsglohuhkHqjWPzP",
            "30x40": "price_1Rr2XsJEVsglohuh2XUXZgj3",
        },
    },
    "alter-ego": {
        title: "Alter Ego",
        sizes: {
            "16x20": "price_1Rr3gKJEVsglohuh9BVqreUW",
            "18x24": "price_1Rr3hqJEVsglohuhTZ312kRH",
            "24x36": "price_1Rr3iwJEVsglohuhOSswWLIo",
            "30x40": "price_1Rr3jxJEVsglohuhyXn8gge8",
        },
    },
    "blind-faith": {
        title: "Blind Faith",
        sizes: {
            "16x20": "price_1TIfofJEVsglohuhDbE7Mrg4",
            "18x24": "price_1TIfojJEVsglohuhIXBkerVl",
            "24x36": "price_1TIfooJEVsglohuhK8Vd5Aol",
            "30x40": "price_1TIfosJEVsglohuhFxQ8BTq8",
        },
    },
    "feathered-serenity": {
        title: "Feathered Serenity",
        sizes: {
            "16x20": "price_1Rr3lJJEVsglohuhi3pXSj4F",
            "18x24": "price_1Rr3mMJEVsglohuhUOHTpz5e",
            "24x36": "price_1Rr3naJEVsglohuhaogXOJGl",
            "30x40": "price_1Rr3oYJEVsglohuhoXCCrGev",
        },
    },
    "fractured-perception": {
        title: "Fractured Perception",
        sizes: {
            "16x20": "price_1Rr3qFJEVsglohuhbOPFj0Vu",
            "18x24": "price_1Rr3rLJEVsglohuhmtOl6U5O",
            "24x36": "price_1Rr3tuJEVsglohuhGLpjacKn",
            "30x40": "price_1Rr3v2JEVsglohuhLGDKPYl9",
        },
    },
    "harmony-in-shadows": {
        title: "Harmony in Shadows",
        sizes: {
            "16x20": "price_1Rr3w4JEVsglohuh2wCoaMUo",
            "18x24": "price_1Rr3xLJEVsglohuhxuNW2KKY",
            "24x36": "price_1Rr3yiJEVsglohuhlP8yLrmi",
            "30x40": "price_1Rr3zqJEVsglohuhR4sjL9qH",
        },
    },
    "illuminated-void": {
        title: "Illuminated Void",
        sizes: {
            "16x20": "price_1Rr40vJEVsglohuhDdPdmNlF",
            "18x24": "price_1Rr46vJEVsglohuhqHrqOZpC",
            "24x36": "price_1Rr47tJEVsglohuhTaVTE7fY",
            "30x40": "price_1Rr4BRJEVsglohuhCEfEzSTo",
        },
    },
    "lost-in-thought": {
        title: "Lost in Thought",
        sizes: {
            "16x20": "price_1Rr4CwJEVsglohuhJnfx2jXU",
            "18x24": "price_1Rr4DlJEVsglohuhff5VaGJO",
            "24x36": "price_1Rr4F2JEVsglohuhsZWdgmpQ",
            "30x40": "price_1Rr4FyJEVsglohuhWabFljdm",
        },
    },
    "love-is-love": {
        title: "Love is Love",
        sizes: {
            "16x20": "price_1Rr4QgJEVsglohuhdTi4Il1P",
            "18x24": "price_1Rr4RkJEVsglohuhbgwqySBn",
            "24x36": "price_1Rr4SrJEVsglohuhQ1Co5hi8",
            "30x40": "price_1Rr4TnJEVsglohuhb5r74XSr",
        },
    },
    "out-for-fame": {
        title: "Out for Fame",
        sizes: {
            "16x20": "price_1Rr4VNJEVsglohuhVOunZVdX",
            "18x24": "price_1Rr4aYJEVsglohuhZIBX65G6",
            "24x36": "price_1Rr4WPJEVsglohuhX7BUoT4o",
            "30x40": "price_1Rr4bnJEVsglohuhfVlhmxmG",
        },
    },
    overwhelmed: {
        title: "Overwhelmed",
        sizes: {
            "16x20": "price_1Rr4dOJEVsglohuhXoZrpaII",
            "18x24": "price_1Rr4f1JEVsglohuhvFra9KRJ",
            "24x36": "price_1Rr4g6JEVsglohuhjZ8jwa2r",
            "30x40": "price_1Rr4hBJEVsglohuhHuB89MUu",
        },
    },
    serenity: {
        title: "Serenity",
        sizes: {
            "16x20": "price_1Rr4iQJEVsglohuhRVl44Pfl",
            "18x24": "price_1Rr4jOJEVsglohuhzvcxlqdJ",
            "24x36": "price_1Rr4kZJEVsglohuhGWgJHXmc",
            "30x40": "price_1Rr4lcJEVsglohuhHRws2D3P",
        },
    },
    "spirit-of-the-knight": {
        title: "Spirit of the Knight",
        sizes: {
            "16x20": "price_1Rr4n6JEVsglohuhIGswNmc5",
            "18x24": "price_1Rr4oMJEVsglohuhWNMtR8If",
            "24x36": "price_1Rr4paJEVsglohuheF9yhQmY",
            "30x40": "price_1Rr4qdJEVsglohuhIVZKdJte",
        },
    },
    "veiled-whispers": {
        title: "Veiled Whispers",
        sizes: {
            "16x20": "price_1Rr6ucJEVsglohuh26FB64EF",
            "18x24": "price_1Rr500JEVsglohuhgAWEwdpZ",
            "24x36": "price_1Rr51iJEVsglohuhdSIZCJZv",
            "30x40": "price_1Rr53CJEVsglohuhe3rZiBFL",
        },
    },
    "walk-in-faith": {
        title: "Walk in Faith",
        sizes: {
            "16x20": "price_1Rr562JEVsglohuhdKGQhWEU",
            "18x24": "price_1Rr57WJEVsglohuh3OPyBdOT",
            "24x36": "price_1Rr58qJEVsglohuhyBhacTmk",
            "30x40": "price_1Rr5DGJEVsglohuhBc2HGVEk",
        },
    },
});

class CheckoutInputError extends Error {
    constructor(message) {
        super(message);
        this.name = "CheckoutInputError";
        this.statusCode = 400;
    }
}

class CheckoutConfigurationError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = "CheckoutConfigurationError";
        this.statusCode = 500;
        this.details = details;
    }
}

function getStripeModeFromSecret(secret) {
    if (typeof secret !== "string") return null;
    if (secret.startsWith("sk_live_")) return "live";
    if (secret.startsWith("sk_test_")) return "test";
    return null;
}

function validateAndAggregateItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
        throw new CheckoutInputError("Your cart is empty.");
    }

    if (items.length > MAX_CART_LINES) {
        throw new CheckoutInputError("Your cart contains too many different items.");
    }

    const aggregated = new Map();

    for (const item of items) {
        if (!item || typeof item !== "object") {
            throw new CheckoutInputError("Your cart contains an invalid item.");
        }

        const { productId, size, quantity } = item;
        if (typeof productId !== "string" || typeof size !== "string") {
            throw new CheckoutInputError("Your cart contains an invalid product or size.");
        }

        if (!Number.isSafeInteger(quantity) || quantity < 1) {
            throw new CheckoutInputError("Item quantities must be whole numbers of at least 1.");
        }

        const product = STRIPE_CATALOG[productId];
        const priceId = product?.sizes?.[size];
        if (!product || !priceId) {
            throw new CheckoutInputError(
                "An item in your cart is no longer available in the selected size."
            );
        }

        const key = `${productId}::${size}`;
        const nextQuantity = (aggregated.get(key)?.quantity || 0) + quantity;
        if (nextQuantity > MAX_ITEM_QUANTITY) {
            throw new CheckoutInputError(
                `Quantity for ${product.title} (${size}) cannot exceed ${MAX_ITEM_QUANTITY}.`
            );
        }

        aggregated.set(key, {
            productId,
            title: product.title,
            size,
            priceId,
            quantity: nextQuantity,
        });
    }

    return [...aggregated.values()];
}

async function buildTrustedCheckout({ items, stripe, expectedLivemode }) {
    if (!stripe?.prices?.retrieve) {
        throw new CheckoutConfigurationError("Stripe price lookup is unavailable.");
    }

    if (typeof expectedLivemode !== "boolean") {
        throw new CheckoutConfigurationError(
            "Stripe credential mode was not provided for catalog validation."
        );
    }

    const expectedMode = expectedLivemode ? "live" : "test";
    const validatedItems = validateAndAggregateItems(items);
    const resolvedItems = await Promise.all(
        validatedItems.map(async (item) => {
            let price;
            try {
                price = await stripe.prices.retrieve(item.priceId);
            } catch (error) {
                throw new CheckoutConfigurationError(
                    `A configured Stripe Price could not be loaded with ${expectedMode} credentials.`,
                    {
                        productId: item.productId,
                        size: item.size,
                        priceId: item.priceId,
                        expectedMode,
                        stripeCode: error?.code || null,
                    }
                );
            }

            if (
                typeof price?.livemode !== "boolean" ||
                price.livemode !== expectedLivemode
            ) {
                throw new CheckoutConfigurationError(
                    "Stripe Price mode does not match the configured secret key mode.",
                    {
                        productId: item.productId,
                        size: item.size,
                        priceId: item.priceId,
                        expectedMode,
                        priceMode:
                            typeof price?.livemode === "boolean"
                                ? price.livemode
                                    ? "live"
                                    : "test"
                                : "unknown",
                    }
                );
            }

            const isValidPrice =
                price?.id === item.priceId &&
                price.active === true &&
                price.type === "one_time" &&
                price.currency === CHECKOUT_CURRENCY &&
                Number.isSafeInteger(price.unit_amount) &&
                price.unit_amount > 0;

            if (!isValidPrice) {
                throw new CheckoutConfigurationError(
                    "A configured Stripe Price is inactive or invalid for checkout.",
                    {
                        productId: item.productId,
                        size: item.size,
                        priceId: item.priceId,
                    }
                );
            }

            return {
                ...item,
                unitAmount: price.unit_amount,
            };
        })
    );

    const orderTotalCents = resolvedItems.reduce(
        (sum, item) => sum + item.unitAmount * item.quantity,
        0
    );

    if (!Number.isSafeInteger(orderTotalCents) || orderTotalCents <= 0) {
        throw new CheckoutConfigurationError("The trusted checkout total is invalid.");
    }

    return {
        lineItems: resolvedItems.map((item) => ({
            price: item.priceId,
            quantity: item.quantity,
        })),
        cartItems: resolvedItems.map((item) => ({
            productId: item.productId,
            title: item.title,
            size: item.size,
            quantity: item.quantity,
            unitPrice: item.unitAmount / 100,
            image: null,
        })),
        orderTotal: orderTotalCents / 100,
        currency: CHECKOUT_CURRENCY.toUpperCase(),
    };
}

module.exports = {
    CHECKOUT_CURRENCY,
    MAX_ITEM_QUANTITY,
    STRIPE_CATALOG,
    CheckoutConfigurationError,
    CheckoutInputError,
    buildTrustedCheckout,
    getStripeModeFromSecret,
    validateAndAggregateItems,
};
