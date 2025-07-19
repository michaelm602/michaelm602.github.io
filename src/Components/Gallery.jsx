// src/components/Gallery.jsx
import { useEffect, useState } from 'react';
import { ref, listAll, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';
import '../styles/Gallery.css';

export default function Gallery({ folder, label }) {
  const [pieces, setPieces] = useState([]);
  const [open, setOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    const fetchImages = async () => {
      try {
        const folderRef = ref(storage, folder);
        const res = await listAll(folderRef);
        const urls = await Promise.all(res.items.map(item => getDownloadURL(item)));

        const formatted = urls.map((url, i) => ({
          src: url,
          title: `${label} Piece #${i + 1}`,
        }));

        setPieces(formatted);
      } catch (err) {
        console.error(`Error loading ${folder} images:`, err);
      }
    };

    fetchImages();
  }, [folder, label]);

  return (
    <>
      <div className="gallery-grid">
  {pieces.map((piece, idx) => (
    <div
      key={idx}
      className="gallery-piece"
      onClick={() => {
        setPhotoIndex(idx);
        setOpen(true);
      }}
    >
      <img src={piece.src} alt={`Gallery Piece ${idx + 1}`} />
    </div>
  ))}
</div>

<Lightbox
  open={open}
  close={() => setOpen(false)}
  index={photoIndex}
  slides={pieces}
  styles={{
    container: {
      backdropFilter: 'blur(10px)',
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      WebkitBackdropFilter: 'blur(10px)',
    },
    slide: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
  }}
  render={{
    slide: ({ slide }) => (
      <img
        src={slide.src}
        alt={slide.caption}
        style={{
          maxWidth: '90vw',
          maxHeight: '90vh',
          objectFit: 'contain',
        }}
      />
    ),
  }}
/>


    </>
  );
}
