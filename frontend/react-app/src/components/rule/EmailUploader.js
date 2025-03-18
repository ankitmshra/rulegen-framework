import React, { useState, useRef } from 'react';
import { emailFileAPI } from '../../services/api';

const EmailUploader = ({ workspaceId, existingFiles, onUploadSuccess, onContinue }) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectedEmailType, setSelectedEmailType] = useState('spam'); // Default to spam
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    // Filter for .eml files only
    const emlFiles = files.filter(file => file.name.toLowerCase().endsWith('.eml'));
    
    if (emlFiles.length !== files.length) {
      setError('Only .eml files are supported. Non-eml files were ignored.');
    }
    
    setSelectedFiles(emlFiles);
  };

  const handleEmailTypeChange = (e) => {
    setSelectedEmailType(e.target.value);
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
      
      setSelectedFiles(emlFiles);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select at least one .eml file to upload');
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    const uploadedFiles = [];
    const totalFiles = selectedFiles.length;
    
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('workspace', workspaceId);
        formData.append('email_type', selectedEmailType);
        
        const response = await emailFileAPI.upload(formData);
        uploadedFiles.push(response.data);
        
        // Update progress
        setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
      }
      
      setSelectedFiles([]);
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

  // Count of each email type
  const spamCount = existingFiles.filter(file => file.email_type === 'spam').length;
  const hamCount = existingFiles.filter(file => file.email_type === 'ham').length;

  return (
    <div className="px-6 py-5">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Upload Email Files</h3>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {/* Email Type Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Email Classification
        </label>
        <div className="flex space-x-4">
          <div className="flex items-center">
            <input
              id="email-type-spam"
              name="email-type"
              type="radio"
              value="spam"
              checked={selectedEmailType === 'spam'}
              onChange={handleEmailTypeChange}
              className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
            />
            <label htmlFor="email-type-spam" className="ml-2 block text-sm text-gray-700">
              Spam
            </label>
          </div>
          <div className="flex items-center">
            <input
              id="email-type-ham"
              name="email-type"
              type="radio"
              value="ham"
              checked={selectedEmailType === 'ham'}
              onChange={handleEmailTypeChange}
              className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
            />
            <label htmlFor="email-type-ham" className="ml-2 block text-sm text-gray-700">
              Ham (Not Spam)
            </label>
          </div>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Select "Spam" for unwanted emails and "Ham" for legitimate emails. For best results, include examples of both types.
        </p>
      </div>

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
              <span>Upload email files</span>
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
            Only .eml files are supported. These will be classified as {selectedEmailType === 'spam' ? (
              <span className="font-semibold text-red-600">SPAM</span>
            ) : (
              <span className="font-semibold text-green-600">HAM</span>
            )}
          </p>
        </div>
      </div>

      {selectedFiles.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Selected Files ({selectedFiles.length}):</h4>
          <ul className="max-h-40 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-200">
            {selectedFiles.map((file, index) => (
              <li key={index} className="pl-3 pr-4 py-2 flex items-center justify-between text-sm">
                <div className="w-0 flex-1 flex items-center">
                  <svg className="flex-shrink-0 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
                  </svg>
                  <span className="ml-2 flex-1 w-0 truncate">{file.name}</span>
                </div>
                <div className="ml-4 flex-shrink-0 flex items-center">
                  <span className="text-xs text-gray-500 mr-2">{(file.size / 1024).toFixed(1)} KB</span>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    selectedEmailType === 'spam' 
                      ? 'bg-red-100 text-red-800' 
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {selectedEmailType === 'spam' ? 'SPAM' : 'HAM'}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isUploading && (
        <div className="mt-4">
          <div className="mb-1 text-sm font-medium flex justify-between">
            <span>Uploading...</span>
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
              Existing Email Files ({existingFiles.length}: {spamCount} Spam, {hamCount} Ham)
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
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        file.email_type === 'spam' 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {file.email_type === 'spam' ? 'SPAM' : 'HAM'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="flex justify-between">
          <button
            type="button"
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || isUploading}
            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
              (selectedFiles.length === 0 || isUploading) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isUploading ? 'Uploading...' : 'Upload Selected Files'}
          </button>
          
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
