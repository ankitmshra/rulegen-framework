import React, { useState, useRef, useEffect } from 'react';

/**
 * Modal component for downloading SpamAssassin rules
 * 
 * @param {boolean} isOpen - Whether the modal is open
 * @param {function} onClose - Function to call when the modal is closed
 * @param {function} onDownload - Function to call with filename when download is confirmed
 */
const DownloadModal = ({ isOpen, onClose, onDownload }) => {
    const [filename, setFilename] = useState('spamassassin_rules');
    const modalRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        // Add event listener for clicking outside the modal
        const handleClickOutside = (event) => {
            if (modalRef.current && !modalRef.current.contains(event.target)) {
                onClose();
            }
        };

        // Focus on input when modal opens
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    const handleSubmit = (e) => {
        e.preventDefault();
        // Make sure we have a valid filename
        if (!filename.trim()) {
            return;
        }
        onDownload(filename);
    };

    // Don't render anything if modal is closed
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                    <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                </div>

                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                <div
                    ref={modalRef}
                    className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"
                >
                    <form onSubmit={handleSubmit}>
                        <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                            <div className="sm:flex sm:items-start">
                                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                                        Download SpamAssassin Rules
                                    </h3>
                                    <div className="mt-2">
                                        <p className="text-sm text-gray-500">
                                            Enter a name for the rule file. The .cf extension will be added automatically.
                                        </p>
                                        <div className="mt-4">
                                            <input
                                                type="text"
                                                value={filename}
                                                onChange={(e) => setFilename(e.target.value)}
                                                ref={inputRef}
                                                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                                placeholder="Enter filename"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                            <button
                                type="submit"
                                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                            >
                                Download
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default DownloadModal;
