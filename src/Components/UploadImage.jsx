import React, { useState, useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, storage } from "../firebase";
import {
  ref,
  uploadBytesResumable,
  deleteObject,
  listAll,
  getDownloadURL,
} from "firebase/storage";

export default function AdminPanel() {
  const [images, setImages] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState("airbrush");
  const [user, setUser] = useState(null);
  const [userLoaded, setUserLoaded] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [loadingImages, setLoadingImages] = useState(true);
  const fileInputRef = useRef(null);

  const FOLDERS = ["airbrush", "photoshop", "portfolio-videos"];
  const ADMIN_EMAIL = "airbrushnink@gmail.com";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setUserLoaded(true);
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
    setLoadingImages(true);
    const listRef = ref(storage, `${selectedFolder}/`);
    const res = await listAll(listRef);

    const urls = await Promise.all(
      res.items.map(async (item) => {
        const url = await getDownloadURL(item);
        return { name: item.name, url, fullRef: item };
      })
    );

    setImages(urls);
    setLoadingImages(false);
  };

  const handleUpload = async () => {
    const file = fileInputRef.current.files[0];
    if (!file) return alert("Please choose a file");
    const imageRef = ref(storage, `${selectedFolder}/${file.name}`);
    setUploading(true);
    setUploadProgress(0);

    const uploadTask = uploadBytesResumable(imageRef, file);

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (error) => {
        console.error(error);
        alert("Upload failed");
        setUploading(false);
      },
      async () => {
        await getDownloadURL(uploadTask.snapshot.ref);
        alert("Upload successful!");
        fileInputRef.current.value = "";
        setUploading(false);
        fetchImages();
      }
    );
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
      <div className="w-full max-w-md p-6 rounded-2xl shadow-lg mb-12 mt-12" style={{ background: "linear-gradient(to right, #000, #222)" }}>
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
          ref={fileInputRef}
          className="w-full mb-4 p-2 rounded bg-black text-white file:bg-[#222] file:text-white file:border-none"
        />

        {uploading && (
          <div className="w-full bg-gray-700 rounded mb-2">
            <div
              className="bg-blue-500 h-2 rounded"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        )}

        <button
          onClick={handleUpload}
          className="w-full py-3 rounded-md font-semibold transition bg-gradient-to-r from-black to-[#222] hover:opacity-80"
          disabled={uploading}
        >
          {uploading ? "Uploading..." : "Upload"}
        </button>
      </div>

      {loadingImages ? (
        <div className="flex justify-center items-center h-40">
          <svg
            className="animate-spin h-8 w-8 text-white"
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
        </div>
      ) : (
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
              {userLoaded && user?.email?.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim() && (
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
      )}
    </div>
  );
}
