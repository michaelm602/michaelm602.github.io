// src/pages/Photoshop.jsx
import Gallery from '../Components/Gallery';
import { Link } from 'react-router-dom';

export default function Photoshop() {
  return <>
    <div className="text-center text-white px-6 pt-10 pb-6">
      <h1 className="text-3xl font-bold mb-4">Photoshop & Design Portfolio</h1>
      <Link to="/contact?intent=photoshop" className="underline underline-offset-4">Request Design Work</Link>
    </div>
    <Gallery folder="photoshop" label="Photoshop" />
  </>;
}
