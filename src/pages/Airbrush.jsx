// src/pages/Airbrush.jsx
import Gallery from '../Components/Gallery';
import { Link } from 'react-router-dom';
import { PAGE_COPY } from '../content/pageCopy';

export default function Airbrush() {
  return <>
    <div className="text-center text-white px-6 pt-10 pb-6">
      <h1 className="text-3xl font-bold mb-4">{PAGE_COPY["/portfolio/airbrush"].heading}</h1>
      <p className="max-w-2xl mx-auto mb-6 leading-relaxed text-zinc-300">{PAGE_COPY["/portfolio/airbrush"].intro}</p>
      <div className="flex flex-wrap justify-center gap-6">
        <Link to="/contact?intent=airbrush" className="underline underline-offset-4">Ask About Airbrush Work</Link>
        <Link to="/shop" className="underline underline-offset-4">Shop Prints</Link>
      </div>
    </div>
    <Gallery folder="airbrush" label="Airbrush" />
  </>;
}
