import { useState, useRef, useEffect, useCallback } from 'react';
import api from '../../api';

function FileUpload({ emailFiles, setEmailFiles, goToNextStep }) {
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({});
    const fileInputRef = useRef(null);

    useEffect(() => {
        // Fetch existing email files when component mounts
        if (emailFiles.length === 0) {
            fetchEmailFiles();
        }
    }, []);

    const fetchEmailFiles = useCallback(async () => {
        try {
            const response = await api.get('/api/email-files/');
            setEmailFiles(response.data);
        } catch (error) {
            console.error('Error fetching email files:', error);
        }
    }, [setEmailFiles]); // Include setEmailFiles as dependency

    useEffect(() => {
        if (emailFiles.length === 0) {
            fetchEmailFiles();
        }
    }, [emailFiles.length, fetchEmailFiles]);

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFiles(files);
        }
    };

    const handleFileInput = (e) => {
        const files = e.target.files;
        if (files.length > 0) {
            handleFiles(files);
        }
    };

    const handleFiles = (files) => {
        // Filter for .eml files
        const validFiles = Array.from(files).filter(file => file.name.toLowerCase().endsWith('.eml'));

        if (validFiles.length !== files.length) {
            alert('Only .eml files are supported. Some files were skipped.');
        }

        if (validFiles.length === 0) return;

        uploadFiles(validFiles);
    };

    const uploadFiles = async (files) => {
        setUploading(true);

        // Initialize progress tracking
        const initialProgress = {};
        files.forEach(file => {
            initialProgress[file.name] = { progress: 0, status: 'uploading' };
        });
        setUploadProgress(initialProgress);

        // Upload each file
        const uploadPromises = files.map(file => uploadFile(file));

        // Wait for all uploads to complete
        await Promise.all(uploadPromises);

        // Fetch updated file list
        fetchEmailFiles();
        setUploading(false);
    };

    const uploadFile = async (file) => {
        const formData = new FormData();
        // Make sure to append the file with the exact key name expected by the backend
        formData.append('file', file);

        try {
            await api.post('/api/email-files/', formData, {
                headers: {
                    // Let the browser set the correct content type with boundary
                    'Content-Type': undefined
                },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(prev => ({
                        ...prev,
                        [file.name]: { progress: percentCompleted, status: 'uploading' }
                    }));
                }
            });

            // Mark as complete
            setUploadProgress(prev => ({
                ...prev,
                [file.name]: { progress: 100, status: 'complete' }
            }));
        } catch (error) {
            console.error(`Error uploading ${file.name}:`, error);
            console.error('Response:', error.response?.data);
            setUploadProgress(prev => ({
                ...prev,
                [file.name]: { progress: 0, status: 'error' }
            }));
        }
    };

    const deleteFile = async (id) => {
        if (!window.confirm('Are you sure you want to delete this file?')) {
            return;
        }

        try {
            await api.delete(`/api/email-files/${id}/`);
            setEmailFiles(prevFiles => prevFiles.filter(file => file.id !== id));
        } catch (error) {
            console.error('Error deleting file:', error);
            alert('Failed to delete file');
        }
    };

    return (
        <div>
            <h2 className="text-xl font-semibold mb-4">Upload Email Files</h2>

            {/* Dropzone */}
            <div
                className={`border-2 border-dashed rounded-lg p-8 mb-6 text-center cursor-pointer transition-colors ${isDragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 hover:bg-gray-50'
                    }`}
                onClick={() => fileInputRef.current.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <i className="fas fa-upload text-5xl text-gray-400 mb-4"></i>
                <p className="text-gray-500">Drag and drop .eml files here or click to browse</p>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".eml"
                    multiple
                    onChange={handleFileInput}
                />
            </div>

            {/* Upload progress */}
            {Object.keys(uploadProgress).length > 0 && (
                <div className="mb-6">
                    <h3 className="text-lg font-medium mb-3">Uploading Files</h3>
                    <div className="space-y-3">
                        {Object.entries(uploadProgress).map(([fileName, { progress, status }]) => (
                            <div key={fileName} className="border rounded-md p-3">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-medium">{fileName}</span>
                                    <span className={`text-sm ${status === 'complete' ? 'text-green-600' :
                                        status === 'error' ? 'text-red-600' : 'text-indigo-600'
                                        }`}>
                                        {status === 'complete' ? 'Complete' :
                                            status === 'error' ? 'Failed' : `${progress}%`}
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full ${status === 'complete' ? 'bg-green-500' :
                                            status === 'error' ? 'bg-red-500' : 'bg-indigo-500'
                                            }`}
                                        style={{ width: `${progress}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* File list */}
            <div className="mb-6">
                <h3 className="text-lg font-medium mb-3">Uploaded Files</h3>
                {emailFiles.length === 0 ? (
                    <p className="text-gray-500 py-3">No files uploaded yet</p>
                ) : (
                    <div className="space-y-2">
                        {emailFiles.map(file => (
                            <div
                                key={file.id}
                                className="flex items-center justify-between p-3 border rounded-md"
                            >
                                <div className="flex items-center">
                                    <i className="fas fa-file-alt text-indigo-500 mr-2"></i>
                                    <span>{file.original_filename}</span>
                                </div>
                                <div className="flex items-center">
                                    <span className="text-green-500 mr-3">
                                        <i className="fas fa-check-circle mr-1"></i> Uploaded
                                    </span>
                                    <button
                                        onClick={() => deleteFile(file.id)}
                                        className="text-red-500 hover:text-red-700 transition-colors"
                                    >
                                        <i className="fas fa-trash-alt"></i>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Navigation */}
            <div className="flex justify-end mt-6">
                <button
                    onClick={goToNextStep}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    disabled={emailFiles.length === 0 || uploading}
                >
                    Next: Select Headers
                </button>
            </div>
        </div>
    );
}

export default FileUpload;
