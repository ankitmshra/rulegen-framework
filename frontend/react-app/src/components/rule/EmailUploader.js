import React, { useState, useRef } from 'react';
import { emailFileAPI } from '../../services/api';

const EmailUploader = ({ workspaceId, existingFiles, onUploadSuccess, onContinue }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentUploadCount, setCurrentUploadCount] = useState(0);
  const [totalUploadCount, setTotalUploadCount] = useState(0);
  const fileInputRef = useRef(null);

  const uploadFiles = async (files) => {
    if (files.length === 0) return;

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);
    setTotalUploadCount(files.length);
    setCurrentUploadCount(0);

    const uploadedFiles = [];
    const totalFiles = files.length;
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('workspace', workspaceId);
        
        const response = await emailFileAPI.upload(formData);
        uploadedFiles.push(response.data);
        
        // Update progress
        const progress = Math.round(((i + 1) / totalFiles) * 100);
        setUploadProgress(progress);
        setCurrentUploadCount(i + 1);
      }
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      onUploadSuccess(uploadedFiles);
    } catch (err) {
      console.error('Error uploading files:', err);
      setError('Failed to upload files: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    // Filter for .eml files only
    const emlFiles = files.filter(file => file.name.toLowerCase().endsWith('.eml'));
    
    if (emlFiles.length !== files.length) {
      setError('Only .eml files are supported. Non-eml files were ignored.');
    }
    
    if (emlFiles.length > 0) {
      uploadFiles(emlFiles);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      // Filter for .eml files only
      const emlFiles = files.filter(file => file.name.toLowerCase().endsWith('.eml'));
      
      if (emlFiles.length !== files.length) {
        setError('Only .eml files are supported. Non-eml files were ignored.');
      }
      
      if (emlFiles.length > 0) {
        uploadFiles(emlFiles);
      }
    }
  };

  const handleDelete = async (fileId) => {
    try {
      setIsDeleting(true);
      await emailFileAPI.delete(fileId);
      // Update the UI by filtering out the deleted file
      const updatedFiles = existingFiles.filter(file => file.id !== fileId);
      onUploadSuccess([], updatedFiles);
    } catch (err) {
      console.error('Error deleting file:', err);
      setError('Failed to delete file: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsDeleting(false);
    }
  };

  // Count of spam files
  const spamCount = existingFiles.length;

  return (
    <div className="px-6 py-5">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Upload Email Files</h3>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      <div 
        className="mt-2 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="space-y-1 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="flex text-sm text-gray-600 justify-center">
            <label
              htmlFor="file-upload"
              className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
            >
              <span>Select email files</span>
              <input
                id="file-upload"
                name="file-upload"
                type="file"
                className="sr-only"
                ref={fileInputRef}
                onChange={handleFileChange}
                multiple
                accept=".eml"
                disabled={isUploading}
              />
            </label>
            <p className="pl-1">or drag and drop</p>
          </div>
          <p className="text-xs text-gray-500">
            Only .eml files are supported. These will be classified as <span className="font-semibold text-red-600">SPAM</span>
          </p>
          <p className="text-xs text-gray-500 pt-1">
            Files will be uploaded automatically when selected
          </p>
        </div>
      </div>

      {isUploading && (
        <div className="mt-4">
          <div className="mb-1 text-sm font-medium flex justify-between">
            <span>Uploading {currentUploadCount} of {totalUploadCount} files...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-indigo-600 h-2 rounded-full"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      <div className="mt-6">
        {existingFiles.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Existing Email Files ({existingFiles.length}: {spamCount} Spam)
            </h4>
            <div className="bg-gray-50 rounded-md p-4 max-h-40 overflow-auto">
              <ul className="divide-y divide-gray-200">
                {existingFiles.map((file) => (
                  <li key={file.id} className="py-2 flex justify-between items-center">
                    <span className="text-sm text-gray-600">{file.original_filename}</span>
                    <div className="flex items-center">
                      <span className="text-xs text-gray-500 mr-3">
                        Uploaded: {new Date(file.uploaded_at).toLocaleDateString()}
                      </span>
                      <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800 mr-3">
                        SPAM
                      </span>
                      <button 
                        onClick={() => handleDelete(file.id)}
                        disabled={isDeleting}
                        className="text-red-600 hover:text-red-900 focus:outline-none"
                        title="Delete file"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onContinue}
            disabled={existingFiles.length === 0 || isUploading}
            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 ${
              (existingFiles.length === 0 || isUploading) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            Continue to Header Selection
            <svg className="ml-2 -mr-1 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailUploader;
