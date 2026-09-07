export const portfolioCategories = [
  {
    slug: "airbrush",
    title: "Airbrush",
    folder: "airbrush",
    path: "/portfolio/airbrush",
    previewImage: "/hero-images/iwata.webp",
    previewAlt: "Airbrush preview",
    visible: true,
  },
  {
    slug: "photoshop",
    title: "Photoshop",
    folder: "photoshop",
    path: "/portfolio/photoshop",
    previewImage: "https://firebasestorage.googleapis.com/v0/b/airbrushnink-9f735.firebasestorage.app/o/photoshop%2Fps1%20(9).jpg?alt=media&token=c96c99c3-7047-4b9f-bc6c-50862fc39c63",
    previewAlt: "Photoshop preview",
    visible: true,
  },
  {
    slug: "tattoos",
    title: "Tattoos",
    folder: "tattoos",
    path: "/portfolio/tattoos",
    previewImage: "https://firebasestorage.googleapis.com/v0/b/airbrushnink-9f735.firebasestorage.app/o/tattoos%2Ftattoo12.jpg?alt=media&token=37c320ff-bc15-402a-a8ba-1b881fefe880",
    previewAlt: "Tattoos preview",
    visible: false,
  },
];

export function getPortfolioCategory(slug) {
  return portfolioCategories.find((category) => category.slug === slug) || null;
}

export function getVisiblePortfolioCategories() {
  return portfolioCategories.filter((category) => category.visible);
}

export function isPortfolioCategoryVisible(slug) {
  return getPortfolioCategory(slug)?.visible === true;
}

export function getPortfolioCategoryDestination(slug) {
  const category = getPortfolioCategory(slug);
  return category?.visible ? category.path : "/portfolio";
}
