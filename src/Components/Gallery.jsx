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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchImages = async () => {
      setLoading(true);
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
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, [folder, label]);

  return (
    <>
      {loading ? (
        <div className="text-center mt-12">
          <svg
            className="animate-spin h-8 w-8 text-white mx-auto"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
            ></path>
          </svg>
          <p className="mt-4 text-sm text-gray-400">Loading gallery...</p>
        </div>
      ) : (
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
      )}

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
