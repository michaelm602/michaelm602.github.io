// src/components/UploadImage.jsx
import React, { useState } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { v4 as uuidv4 } from 'uuid';

const UploadImage = () => {
  const [image, setImage] = useState(null);
  const [url, setUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  const handleUpload = () => {
    if (!image) return;

    setIsUploading(true);
    setUploadStatus('Uploading...');

    const imageRef = ref(storage, `uploads/${uuidv4()}-${image.name}`);
    uploadBytes(imageRef, image)
      .then(snapshot => getDownloadURL(snapshot.ref))
      .then(downloadURL => {
        setUrl(downloadURL);
        setUploadStatus('Upload successful!');
      })
      .catch(error => {
        console.error('Upload failed:', error);
        setUploadStatus('Upload failed. Try again.');
      })
      .finally(() => {
        setIsUploading(false);
      });
  };

  return (
    <div className="p-6 max-w-lg mx-auto bg-white rounded-lg shadow-md mt-6 border border-gray-200">
      <h2 className="text-2xl font-semibold text-center mb-4 text-gray-800">Upload Your Artwork</h2>
      <input
        type="file"
        accept="image/*"
        className="w-full p-2 border rounded mb-4"
        onChange={e => setImage(e.target.files[0])}
      />
      <button
        onClick={handleUpload}
        disabled={isUploading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition duration-200"
      >
        {isUploading ? 'Uploading...' : 'Upload'}
      </button>
      {uploadStatus && <p className="mt-3 text-center text-sm text-gray-700">{uploadStatus}</p>}
      {url && (
        <div className="mt-6 text-center">
          <p className="text-gray-800 font-medium">Uploaded Image:</p>
          <img src={url} alt="Uploaded preview" className="mt-2 max-w-xs mx-auto rounded" />
        </div>
      )}
    </div>
  );
};

export default UploadImage;
