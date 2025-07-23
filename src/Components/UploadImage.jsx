import React, { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, storage } from "../firebase";
import {
  ref,
  uploadBytes,
  deleteObject,
  listAll,
  getDownloadURL,
} from "firebase/storage";

export default function AdminPanel() {
  const [image, setImage] = useState(null);
  const [images, setImages] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState("tattoos");
  const [user, setUser] = useState(null);
  const [userLoaded, setUserLoaded] = useState(false);

  const FOLDERS = ["airbrush", "tattoos", "photoshop", "portfolio-videos"];
  const ADMIN_EMAIL = "airbrushnink@gmail.com";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setUserLoaded(true); // ✅ Done loading
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (userLoaded) {
      fetchImages();
    }
  }, [userLoaded]);

  useEffect(() => {
    fetchImages();
  }, [selectedFolder]);

  const fetchImages = async () => {
    const listRef = ref(storage, `${selectedFolder}/`);
    const res = await listAll(listRef);

    const urls = await Promise.all(
      res.items.map(async (item) => {
        const url = await getDownloadURL(item);
        return { name: item.name, url, fullRef: item };
      })
    );

    setImages(urls);
  };

  const handleUpload = async () => {
    if (!image) return alert("Please choose a file");
    const imageRef = ref(storage, `${selectedFolder}/${image.name}`);
    try {
      await uploadBytes(imageRef, image);
      alert("Upload successful!");
      setImage(null);
      fetchImages();
    } catch (err) {
      console.error(err);
      alert("Upload failed");
    }
  };

  const handleDelete = async (imgRef) => {
    const confirm = window.confirm("Delete this image?");
    if (!confirm) return;

    try {
      await deleteObject(imgRef.fullRef);
      alert("Deleted successfully");
      fetchImages();
    } catch (err) {
      console.error(err);
      alert("Failed to delete");
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen  bg-gradient-to-r from-black via-[#111] to-[#222] text-white px-4 pb-12">
      {/* Upload Form */}
      <div
        className="w-full max-w-md p-6 rounded-2xl shadow-lg mb-12 mt-12"
        style={{ background: "linear-gradient(to right, #000, #222)" }}
      >
        <h2 className="text-2xl font-bold text-center mb-4">Upload Your Artwork</h2>

        <select
          value={selectedFolder}
          onChange={(e) => setSelectedFolder(e.target.value)}
          className="w-full mb-4 p-2 rounded bg-black text-white"
        >
          {FOLDERS.map((folder) => (
            <option key={folder} value={folder}>
              {folder.charAt(0).toUpperCase() + folder.slice(1)}
            </option>
          ))}
        </select>

        <input
          type="file"
          onChange={(e) => setImage(e.target.files[0])}
          className="w-full mb-4 p-2 rounded bg-black text-white file:bg-[#222] file:text-white file:border-none"
        />

        <button
          onClick={handleUpload}
          className="w-full py-3 rounded-md font-semibold transition bg-gradient-to-r from-black to-[#222] hover:opacity-80"
        >
          Upload
        </button>
      </div>

      {/* Gallery Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {images.map((img) => (
          <div
            key={img.name}
            className="flex flex-col items-center justify-between w-full h-[420px]"
          >
            <img
              src={img.url}
              alt={img.name}
              className="object-contain w-[290px] h-[300px] sm:w-[400px] sm:h-[350px] rounded-md shadow-md"
            />
            {userLoaded &&
              user?.email?.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim() && (
                <button
                  onClick={() => handleDelete(img)}
                  className="mt-2 px-4 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded"
                >
                  Delete
                </button>
              )}
          </div>
        ))}
      </div>
    </div>
  );
}
