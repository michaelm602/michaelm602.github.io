// src/components/UploadImage.jsx
import React, { useState } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, db } from '../firebase';
import { v4 as uuidv4 } from 'uuid';
import { collection, addDoc } from 'firebase/firestore';

const UploadImage = () => {
  const [image, setImage] = useState(null);
  const [url, setUrl] = useState('');
  const [folder, setFolder] = useState('');

  const handleUpload = async () => {
    if (!image) return;
    if (!folder) {
      alert("Pick a folder before uploading!");
      return;
    }

    const file = image;
    const imageRef = ref(storage, `${folder}/${file.name}`);

    try {
      const snapshot = await uploadBytes(imageRef, image);
      const downloadURL = await getDownloadURL(snapshot.ref);

      setUrl(downloadURL);

      // Save image URL to Firestore
      await addDoc(collection(db, 'uploadedImages'), {
        url: downloadURL,
        createdAt: new Date(),
      });

      console.log('Uploaded & saved:', downloadURL);
    } catch (error) {
      console.error("Upload failed:", error);
    }
  };

  return (
    <div className="upload-container">
      <h2>Upload Artwork</h2>

      <label>Choose Category:</label>
      <select
        value={folder}
        onChange={(e) => setFolder(e.target.value)}
        className="mb-4 p-2 border rounded"
      >
        <option value="">-- Select Folder --</option>
        <option value="airbrush">Airbrush</option>
        <option value="tattoos">Tattoos</option>
        <option value="photoshop">Photoshop</option>
      </select>

      <input
        type="file"
        onChange={(e) => setImage(e.target.files[0])}
        className="mb-4"
      />
      <button onClick={handleUpload} className="p-2 bg-black text-white rounded">
        Upload
      </button>

      {url && (
        <div className="mt-4">
          <p>Uploaded Image:</p>
          <img src={url} alt="Uploaded" style={{ maxWidth: '300px' }} />
        </div>
      )}
    </div>
  );
};

export default UploadImage;
