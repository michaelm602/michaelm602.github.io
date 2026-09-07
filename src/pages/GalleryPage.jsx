import Gallery from "../Components/Gallery";
import { getVisiblePortfolioCategories } from "../config/portfolioCategories";

export default function GalleryPage() {
  const categories = getVisiblePortfolioCategories();

  return (
    <>


      <div className="min-h-screen bg-black text-white pt-24 px-4">
        <h1 className="text-4xl font-bold text-center mb-12">Gallery</h1>

        {categories.map((category) => (
          <section key={category.slug} className="mb-20">
            <h2 className="text-2xl font-semibold text-center mb-6">{category.title}</h2>
            <Gallery folder={category.folder} label={category.title} />
          </section>
        ))}
      </div>
    </>
  );
}
