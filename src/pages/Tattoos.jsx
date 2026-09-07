import Gallery from "../Components/Gallery";

export default function Tattoos() {
  return <>
    <div className="text-center text-white px-6 pt-10 pb-6">
      <h1 className="text-3xl font-bold mb-3">Tattoo Portfolio</h1>
      <p className="text-zinc-300">Past work, shown as portfolio only.</p>
    </div>
    <Gallery folder="tattoos" label="Tattoo" />
  </>;
}
