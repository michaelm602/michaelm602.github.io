const SIZE_DEFINITIONS = {
  "16x20": { price: 100 },
  "18x24": { price: 200 },
  "24x36": { price: 300 },
  "30x40": { price: 400 },
};

function buildSizes(stripePriceIds = {}) {
  return Object.entries(SIZE_DEFINITIONS).map(([label, { price }]) => ({
    label,
    price,
    stripePriceId: stripePriceIds[label],
  }));
}

function inferThumbPath(fullPath) {
  if (!fullPath || !fullPath.toLowerCase().endsWith(".webp")) return null;
  return fullPath.replace(/\.webp$/i, "__thumb.webp");
}

function buildImagePaths(fullPath, alt, thumbPath = inferThumbPath(fullPath)) {
  return [
    {
      thumb: thumbPath,
      full: fullPath,
      alt,
    },
  ];
}

export const products = [
  {
    id: "adoration-in-the-lights-darkness",
    slug: "adoration-in-the-lights-darkness",
    title: "Adoration in the lights darkness",
    description: "Light finds its way through even the deepest dark - this piece holds that tension.",
    shortDescription: "For the ones who feel everything.",
    category: "Airbrush · Original Print",
    tags: ["airbrush", "faith", "shadow", "portrait"],
    featured: true,
    images: buildImagePaths(
      "airbrush/Adoration in the lights darkness.webp",
      "Adoration in the lights darkness airbrush print by Likwit Blvd"
    ),
    sizes: buildSizes({
      "16x20": "price_1Rr1y0JEVsglohuhBAH3v1Hm",
      "18x24": "price_1Rr2RvJEVsglohuhe4npKcRX",
      "24x36": "price_1Rr2V9JEVsglohuhkHqjWPzP",
      "30x40": "price_1Rr2XsJEVsglohuh2XUXZgj3",
    }),
    defaultSize: "16x20",
    seo: {
      title: "Adoration in the lights darkness - Airbrush Artwork Print | Likwit Blvd",
      description: "Adoration in the lights darkness original airbrush artwork print by Likwit Blvd. Hand-finished and made to order.",
    },
    relatedProductIds: ["walk-in-faith", "blind-faith", "harmony-in-shadows"],
    status: "active",
  },
  {
    id: "alter-ego",
    slug: "alter-ego",
    title: "Alter Ego",
    description: "Two versions of the same person, neither one wrong - just one you show and one you carry.",
    shortDescription: "A piece people stop and stare at. Then ask about.",
    category: "Airbrush · Original Print",
    tags: ["airbrush", "identity", "portrait", "surreal"],
    featured: true,
    images: buildImagePaths(
      "airbrush/Alter Ego.webp",
      "Alter Ego airbrush print by Likwit Blvd"
    ),
    sizes: buildSizes({
      "16x20": "price_1Rr3gKJEVsglohuh9BVqreUW",
      "18x24": "price_1Rr3hqJEVsglohuhTZ312kRH",
      "24x36": "price_1Rr3iwJEVsglohuhOSswWLIo",
      "30x40": "price_1Rr3jxJEVsglohuhyXn8gge8",
    }),
    defaultSize: "16x20",
    seo: {
      title: "Alter Ego - Airbrush Artwork Print | Likwit Blvd",
      description: "Alter Ego original airbrush artwork print by Likwit Blvd. Hand-finished and made to order.",
    },
    relatedProductIds: ["fractured-perception", "lost-in-thought", "overwhelmed"],
    status: "active",
  },
  {
    id: "blind-faith",
    slug: "blind-faith",
    title: "Blind Faith",
    description: "Surrender isn't weakness - this piece captures the courage it takes to let go and trust.",
    shortDescription: "For the ones who keep going without a guarantee.",
    category: "Airbrush · Original Print",
    tags: ["airbrush", "faith", "portrait", "emotion"],
    featured: false,
    images: buildImagePaths(
      "airbrush/Blind Faith.webp",
      "Blind Faith airbrush print by Likwit Blvd"
    ),
    sizes: buildSizes({
      "16x20": "price_1TIfofJEVsglohuhDbE7Mrg4",
      "18x24": "price_1TIfojJEVsglohuhIXBkerVl",
      "24x36": "price_1TIfooJEVsglohuhK8Vd5Aol",
      "30x40": "price_1TIfosJEVsglohuhFxQ8BTq8",
    }),
    defaultSize: "16x20",
    seo: {
      title: "Blind Faith - Airbrush Artwork Print | Likwit Blvd",
      description: "Blind Faith original airbrush artwork print by Likwit Blvd. Hand-finished and made to order.",
    },
    relatedProductIds: ["walk-in-faith", "adoration-in-the-lights-darkness", "serenity"],
    status: "active",
  },
  {
    id: "feathered-serenity",
    slug: "feathered-serenity",
    title: "Feathered Serenity",
    description: "Stillness made visible. Every feather placed with intention.",
    shortDescription: "Soft, but it commands the room.",
    category: "Airbrush · Original Print",
    tags: ["airbrush", "serenity", "nature", "light"],
    featured: false,
    images: buildImagePaths(
      "airbrush/Feathered Serenity.webp",
      "Feathered Serenity airbrush print by Likwit Blvd"
    ),
    sizes: buildSizes({
      "16x20": "price_1Rr3lJJEVsglohuhi3pXSj4F",
      "18x24": "price_1Rr3mMJEVsglohuhUOHTpz5e",
      "24x36": "price_1Rr3naJEVsglohuhaogXOJGl",
      "30x40": "price_1Rr3oYJEVsglohuhoXCCrGev",
    }),
    defaultSize: "16x20",
    seo: {
      title: "Feathered Serenity - Airbrush Artwork Print | Likwit Blvd",
      description: "Feathered Serenity original airbrush artwork print by Likwit Blvd. Hand-finished and made to order.",
    },
    relatedProductIds: ["serenity", "harmony-in-shadows", "veiled-whispers"],
    status: "active",
  },
  {
    id: "fractured-perception",
    slug: "fractured-perception",
    title: "Fractured Perception",
    description: "Reality isn't one thing - this piece explores the cracks between versions of it.",
    shortDescription: "The more you look, the more you see.",
    category: "Airbrush · Original Print",
    tags: ["airbrush", "surreal", "identity", "portrait"],
    featured: true,
    images: buildImagePaths(
      "airbrush/Fractured Perception.webp",
      "Fractured Perception airbrush print by Likwit Blvd"
    ),
    sizes: buildSizes({
      "16x20": "price_1Rr3qFJEVsglohuhbOPFj0Vu",
      "18x24": "price_1Rr3rLJEVsglohuhmtOl6U5O",
      "24x36": "price_1Rr3tuJEVsglohuhGLpjacKn",
      "30x40": "price_1Rr3v2JEVsglohuhLGDKPYl9",
    }),
    defaultSize: "16x20",
    seo: {
      title: "Fractured Perception - Airbrush Artwork Print | Likwit Blvd",
      description: "Fractured Perception original airbrush artwork print by Likwit Blvd. Hand-finished and made to order.",
    },
    relatedProductIds: ["alter-ego", "overwhelmed", "lost-in-thought"],
    status: "active",
  },
  {
    id: "harmony-in-shadows",
    slug: "harmony-in-shadows",
    title: "Harmony in Shadows",
    description: "Balance doesn't always live in the light - sometimes it hides where the eye doesn't go first.",
    shortDescription: "A slow burn. The kind that stays with you.",
    category: "Airbrush · Original Print",
    tags: ["airbrush", "shadow", "serenity", "portrait"],
    featured: false,
    images: buildImagePaths(
      "airbrush/Harmony in Shadows.webp",
      "Harmony in Shadows airbrush print by Likwit Blvd"
    ),
    sizes: buildSizes({
      "16x20": "price_1Rr3w4JEVsglohuh2wCoaMUo",
      "18x24": "price_1Rr3xLJEVsglohuhxuNW2KKY",
      "24x36": "price_1Rr3yiJEVsglohuhlP8yLrmi",
      "30x40": "price_1Rr3zqJEVsglohuhR4sjL9qH",
    }),
    defaultSize: "16x20",
    seo: {
      title: "Harmony in Shadows - Airbrush Artwork Print | Likwit Blvd",
      description: "Harmony in Shadows original airbrush artwork print by Likwit Blvd. Hand-finished and made to order.",
    },
    relatedProductIds: ["feathered-serenity", "veiled-whispers", "illuminated-void"],
    status: "active",
  },
  {
    id: "illuminated-void",
    slug: "illuminated-void",
    title: "Illuminated Void",
    description: "Emptiness rendered luminous. A paradox you can hang on a wall.",
    shortDescription: "It fills a room without trying.",
    category: "Airbrush · Original Print",
    tags: ["airbrush", "shadow", "light", "surreal"],
    featured: false,
    images: buildImagePaths(
      "airbrush/Illuminated Void.webp",
      "Illuminated Void airbrush print by Likwit Blvd"
    ),
    sizes: buildSizes({
      "16x20": "price_1Rr40vJEVsglohuhDdPdmNlF",
      "18x24": "price_1Rr46vJEVsglohuhqHrqOZpC",
      "24x36": "price_1Rr47tJEVsglohuhTaVTE7fY",
      "30x40": "price_1Rr4BRJEVsglohuhCEfEzSTo",
    }),
    defaultSize: "16x20",
    seo: {
      title: "Illuminated Void - Airbrush Artwork Print | Likwit Blvd",
      description: "Illuminated Void original airbrush artwork print by Likwit Blvd. Hand-finished and made to order.",
    },
    relatedProductIds: ["harmony-in-shadows", "veiled-whispers", "serenity"],
    status: "active",
  },
  {
    id: "lost-in-thought",
    slug: "lost-in-thought",
    title: "Lost in Thought",
    description: "Everyone's been there. This piece captures that exact place between presence and somewhere else.",
    shortDescription: "People recognize themselves in it.",
    category: "Airbrush · Original Print",
    tags: ["airbrush", "portrait", "emotion", "identity"],
    featured: false,
    images: buildImagePaths(
      "airbrush/Lost in Thought.webp",
      "Lost in Thought airbrush print by Likwit Blvd"
    ),
    sizes: buildSizes({
      "16x20": "price_1Rr4CwJEVsglohuhJnfx2jXU",
      "18x24": "price_1Rr4DlJEVsglohuhff5VaGJO",
      "24x36": "price_1Rr4F2JEVsglohuhsZWdgmpQ",
      "30x40": "price_1Rr4FyJEVsglohuhWabFljdm",
    }),
    defaultSize: "16x20",
    seo: {
      title: "Lost in Thought - Airbrush Artwork Print | Likwit Blvd",
      description: "Lost in Thought original airbrush artwork print by Likwit Blvd. Hand-finished and made to order.",
    },
    relatedProductIds: ["alter-ego", "overwhelmed", "fractured-perception"],
    status: "active",
  },
  {
    id: "love-is-love",
    slug: "love-is-love",
    title: "Love is Love",
    description: "No conditions. No exceptions. Just the thing itself.",
    shortDescription: "Unapologetic. Exactly as it should be.",
    category: "Airbrush · Original Print",
    tags: ["airbrush", "love", "portrait", "statement"],
    featured: false,
    images: buildImagePaths(
      "airbrush/Love is Love.webp",
      "Love is Love airbrush print by Likwit Blvd"
    ),
    sizes: buildSizes({
      "16x20": "price_1Rr4QgJEVsglohuhdTi4Il1P",
      "18x24": "price_1Rr4RkJEVsglohuhbgwqySBn",
      "24x36": "price_1Rr4SrJEVsglohuhQ1Co5hi8",
      "30x40": "price_1Rr4TnJEVsglohuhb5r74XSr",
    }),
    defaultSize: "16x20",
    seo: {
      title: "Love is Love - Airbrush Artwork Print | Likwit Blvd",
      description: "Love is Love original airbrush artwork print by Likwit Blvd. Hand-finished and made to order.",
    },
    relatedProductIds: ["adoration-in-the-lights-darkness", "serenity", "veiled-whispers"],
    status: "active",
  },
  {
    id: "out-for-fame",
    slug: "out-for-fame",
    title: "Out for Fame",
    description: "Ambition made visible. Street energy, gallery presence.",
    shortDescription: "Built for walls that mean something.",
    category: "Airbrush · Original Print",
    tags: ["airbrush", "street", "portrait", "statement"],
    featured: false,
    images: buildImagePaths(
      "airbrush/Out For Fame.webp",
      "Out for Fame airbrush print by Likwit Blvd"
    ),
    sizes: buildSizes({
      "16x20": "price_1Rr4VNJEVsglohuhVOunZVdX",
      "18x24": "price_1Rr4aYJEVsglohuhZIBX65G6",
      "24x36": "price_1Rr4WPJEVsglohuhX7BUoT4o",
      "30x40": "price_1Rr4bnJEVsglohuhfVlhmxmG",
    }),
    defaultSize: "16x20",
    seo: {
      title: "Out for Fame - Airbrush Artwork Print | Likwit Blvd",
      description: "Out for Fame original airbrush artwork print by Likwit Blvd. Hand-finished and made to order.",
    },
    relatedProductIds: ["spirit-of-the-knight", "love-is-love", "fractured-perception"],
    status: "active",
  },
  {
    id: "overwhelmed",
    slug: "overwhelmed",
    title: "Overwhelmed",
    description: "The moment before breaking - and the beauty that lives there.",
    shortDescription: "Uncomfortable. Honest. Hard to look away.",
    category: "Airbrush · Original Print",
    tags: ["airbrush", "emotion", "portrait", "surreal"],
    featured: true,
    images: buildImagePaths(
      "airbrush/Overwhelmed.webp",
      "Overwhelmed airbrush print by Likwit Blvd"
    ),
    sizes: buildSizes({
      "16x20": "price_1Rr4dOJEVsglohuhXoZrpaII",
      "18x24": "price_1Rr4f1JEVsglohuhvFra9KRJ",
      "24x36": "price_1Rr4g6JEVsglohuhjZ8jwa2r",
      "30x40": "price_1Rr4hBJEVsglohuhHuB89MUu",
    }),
    defaultSize: "16x20",
    seo: {
      title: "Overwhelmed - Airbrush Artwork Print | Likwit Blvd",
      description: "Overwhelmed original airbrush artwork print by Likwit Blvd. Hand-finished and made to order.",
    },
    relatedProductIds: ["lost-in-thought", "fractured-perception", "alter-ego"],
    status: "active",
  },
  {
    id: "serenity",
    slug: "serenity",
    title: "Serenity",
    description: "Pure stillness. A piece that slows the room down.",
    shortDescription: "The quiet kind of powerful.",
    category: "Airbrush · Original Print",
    tags: ["airbrush", "serenity", "light", "portrait"],
    featured: false,
    images: buildImagePaths(
      "airbrush/Serenity.webp",
      "Serenity airbrush print by Likwit Blvd"
    ),
    sizes: buildSizes({
      "16x20": "price_1Rr4iQJEVsglohuhRVl44Pfl",
      "18x24": "price_1Rr4jOJEVsglohuhzvcxlqdJ",
      "24x36": "price_1Rr4kZJEVsglohuhGWgJHXmc",
      "30x40": "price_1Rr4lcJEVsglohuhHRws2D3P",
    }),
    defaultSize: "16x20",
    seo: {
      title: "Serenity - Airbrush Artwork Print | Likwit Blvd",
      description: "Serenity original airbrush artwork print by Likwit Blvd. Hand-finished and made to order.",
    },
    relatedProductIds: ["feathered-serenity", "blind-faith", "walk-in-faith"],
    status: "active",
  },
  {
    id: "spirit-of-the-knight",
    slug: "spirit-of-the-knight",
    title: "Spirit of the Knight",
    description: "Valor without vanity. A piece about what it means to stand for something.",
    shortDescription: "Commands attention the moment it's on the wall.",
    category: "Airbrush · Original Print",
    tags: ["airbrush", "valor", "portrait", "statement"],
    featured: false,
    images: buildImagePaths(
      "airbrush/Spirit of the Knight.webp",
      "Spirit of the Knight airbrush print by Likwit Blvd"
    ),
    sizes: buildSizes({
      "16x20": "price_1Rr4n6JEVsglohuhIGswNmc5",
      "18x24": "price_1Rr4oMJEVsglohuhWNMtR8If",
      "24x36": "price_1Rr4paJEVsglohuheF9yhQmY",
      "30x40": "price_1Rr4qdJEVsglohuhIVZKdJte",
    }),
    defaultSize: "16x20",
    seo: {
      title: "Spirit of the Knight - Airbrush Artwork Print | Likwit Blvd",
      description: "Spirit of the Knight original airbrush artwork print by Likwit Blvd. Hand-finished and made to order.",
    },
    relatedProductIds: ["out-for-fame", "veiled-whispers", "harmony-in-shadows"],
    status: "active",
  },
  {
    id: "veiled-whispers",
    slug: "veiled-whispers",
    title: "Veiled Whispers",
    description: "Secrets held in layers of shadow and light. You won't catch everything on first look.",
    shortDescription: "The kind that rewards close attention.",
    category: "Airbrush · Original Print",
    tags: ["airbrush", "shadow", "portrait", "surreal"],
    featured: false,
    images: buildImagePaths(
      "airbrush/Veiled Whispers.webp",
      "Veiled Whispers airbrush print by Likwit Blvd"
    ),
    sizes: buildSizes({
      "16x20": "price_1Rr6ucJEVsglohuh26FB64EF",
      "18x24": "price_1Rr500JEVsglohuhgAWEwdpZ",
      "24x36": "price_1Rr51iJEVsglohuhdSIZCJZv",
      "30x40": "price_1Rr53CJEVsglohuhe3rZiBFL",
    }),
    defaultSize: "16x20",
    seo: {
      title: "Veiled Whispers - Airbrush Artwork Print | Likwit Blvd",
      description: "Veiled Whispers original airbrush artwork print by Likwit Blvd. Hand-finished and made to order.",
    },
    relatedProductIds: ["harmony-in-shadows", "illuminated-void", "feathered-serenity"],
    status: "active",
  },
  {
    id: "walk-in-faith",
    slug: "walk-in-faith",
    title: "Walk in Faith",
    description: "Forward, even when the path isn't clear. This piece is for that.",
    shortDescription: "People put it somewhere they see every morning.",
    category: "Airbrush · Original Print",
    tags: ["airbrush", "faith", "serenity", "portrait"],
    featured: true,
    images: buildImagePaths(
      "airbrush/Walk in Faith.webp",
      "Walk in Faith airbrush print by Likwit Blvd"
    ),
    sizes: buildSizes({
      "16x20": "price_1Rr562JEVsglohuhdKGQhWEU",
      "18x24": "price_1Rr57WJEVsglohuh3OPyBdOT",
      "24x36": "price_1Rr58qJEVsglohuhyBhacTmk",
      "30x40": "price_1Rr5DGJEVsglohuhBc2HGVEk",
    }),
    defaultSize: "16x20",
    seo: {
      title: "Walk in Faith - Airbrush Artwork Print | Likwit Blvd",
      description: "Walk in Faith original airbrush artwork print by Likwit Blvd. Hand-finished and made to order.",
    },
    relatedProductIds: ["blind-faith", "adoration-in-the-lights-darkness", "serenity"],
    status: "active",
  },
];

export function getAllProducts({ includeDrafts = false } = {}) {
  return includeDrafts ? products : products.filter((product) => product.status !== "draft");
}

export function getProductBySlug(slug) {
  return getAllProducts({ includeDrafts: true }).find((product) => product.slug === slug) || null;
}

export function getProductById(id) {
  return getAllProducts({ includeDrafts: true }).find((product) => product.id === id) || null;
}

export function getProductByTitle(title) {
  return getAllProducts({ includeDrafts: true }).find((product) => product.title === title) || null;
}

export function resolveProduct(productOrIdOrTitle) {
  if (!productOrIdOrTitle) return null;
  if (typeof productOrIdOrTitle === "object") return productOrIdOrTitle;
  return getProductById(productOrIdOrTitle) || getProductByTitle(productOrIdOrTitle);
}

export function resolveCartItemProduct(cartItem) {
  return getProductById(cartItem?.productId) || getProductByTitle(cartItem?.title) || null;
}

export function getPrimaryProductImage(product) {
  return product?.images?.[0] || null;
}

export function getProductSizeOptions(product) {
  return product?.sizes || [];
}

export function getProductSize(product, sizeLabel) {
  return getProductSizeOptions(product).find((size) => size.label === sizeLabel) || null;
}

export function getProductPrice(product, sizeLabel) {
  return getProductSize(product, sizeLabel)?.price ?? null;
}

export function getProductMinPrice(product) {
  const prices = getProductSizeOptions(product).map((size) => size.price);
  return prices.length ? Math.min(...prices) : 0;
}

export function getDefaultProductSize(product) {
  return getProductSize(product, product?.defaultSize) || getProductSizeOptions(product)[0] || null;
}

export function getStripePriceId(productOrIdOrTitle, sizeLabel) {
  const product = resolveProduct(productOrIdOrTitle);
  return getProductSize(product, sizeLabel)?.stripePriceId;
}

function getRelatedFallbackProducts(product, allProducts) {
  const productTags = new Set(product?.tags || []);

  return allProducts
    .filter((candidate) => candidate.id !== product.id)
    .map((candidate) => {
      let score = 0;

      if (candidate.category && candidate.category === product.category) score += 2;
      for (const tag of candidate.tags || []) {
        if (productTags.has(tag)) score += 1;
      }

      return { candidate, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.title.localeCompare(b.candidate.title))
    .map(({ candidate }) => candidate);
}

export function getRelatedProducts(product, allProducts = getAllProducts()) {
  if (!product) return [];

  const explicit = (product.relatedProductIds || [])
    .map((id) => allProducts.find((candidate) => candidate.id === id))
    .filter(Boolean);

  const fallback = getRelatedFallbackProducts(product, allProducts).filter(
    (candidate) => !explicit.some((related) => related.id === candidate.id)
  );

  return [...explicit, ...fallback].slice(0, 3);
}
