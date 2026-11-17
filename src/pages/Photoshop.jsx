// src/pages/Photoshop.jsx
import Gallery from '../Components/Gallery';
import { Link } from 'react-router-dom';
import { PAGE_COPY } from '../content/pageCopy';

export default function Photoshop() {
  return <>
    <div className="text-center text-white px-6 pt-10 pb-6">
      <h1 className="text-3xl font-bold mb-4">{PAGE_COPY["/portfolio/photoshop"].heading}</h1>
      <p className="max-w-2xl mx-auto mb-6 leading-relaxed text-zinc-300">{PAGE_COPY["/portfolio/photoshop"].intro}</p>
      <Link to="/contact?intent=photoshop" className="underline underline-offset-4">Request Design Work</Link>
    </div>
    <Gallery folder="photoshop" label="Photoshop" />
  </>;
}
