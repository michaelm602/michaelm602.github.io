import Gallery from "../Components/Gallery";
import { getVisiblePortfolioCategories } from "../config/portfolioCategories";
import { PAGE_COPY } from "../content/pageCopy";

export default function GalleryPage() {
  const categories = getVisiblePortfolioCategories();

  return (
    <>


      <div className="min-h-screen bg-black text-white pt-24 px-4">
        <h1 className="text-4xl font-bold text-center mb-4">{PAGE_COPY["/gallery"].heading}</h1>
        <p className="max-w-2xl mx-auto mb-12 text-center leading-relaxed text-zinc-300">{PAGE_COPY["/gallery"].intro}</p>

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
