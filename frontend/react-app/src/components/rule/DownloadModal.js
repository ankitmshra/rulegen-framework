import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Modal component for downloading SpamAssassin rules
 * 
 * @param {boolean} isOpen - Whether the modal is open
 * @param {function} onClose - Function to call when the modal is closed
 * @param {function} onDownload - Function to call with filename when download is confirmed
 */
const DownloadModal = ({ isOpen, onClose, onDownload }) => {
    const [filename, setFilename] = useState('spamassassin_rules');
    const [isVisible, setIsVisible] = useState(true); // Track modal visibility
    const modalRef = useRef(null);
    const inputRef = useRef(null);

    // Reset visibility when isOpen changes
    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
        }
    }, [isOpen]);

    useEffect(() => {
        // Add event listener for clicking outside the modal
        const handleClickOutside = (event) => {
            if (modalRef.current && !modalRef.current.contains(event.target)) {
                handleClose();
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
    }, [isOpen]);

    // Handle close with animation
    const handleClose = () => {
        setIsVisible(false);
        // Delay actual onClose to allow animation to complete
        setTimeout(() => {
            onClose();
        }, 300); // Match animation duration
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // Make sure we have a valid filename
        if (!filename.trim()) {
            return;
        }
        onDownload(filename);
    };

    // Don't render anything if modal is not open
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            {isVisible && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.75 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="fixed inset-0 z-40" 
                            aria-hidden="true"
                        >
                            <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                        </motion.div>

                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                        <motion.div
                            ref={modalRef}
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ duration: 0.3, type: "spring", bounce: 0.25 }}
                            className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl z-50 relative sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <form onSubmit={handleSubmit}>
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="sm:flex sm:items-start">
                                        <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                                            <motion.h3 
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.1 }}
                                                className="text-lg leading-6 font-medium text-gray-900"
                                            >
                                                Download SpamAssassin Rules
                                            </motion.h3>
                                            <div className="mt-2">
                                                <motion.p 
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={{ delay: 0.2 }}
                                                    className="text-sm text-gray-500"
                                                >
                                                    Enter a name for the rule file. The .cf extension will be added automatically.
                                                </motion.p>
                                                <motion.div 
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: 0.3 }}
                                                    className="mt-4"
                                                >
                                                    <input
                                                        type="text"
                                                        value={filename}
                                                        onChange={(e) => setFilename(e.target.value)}
                                                        ref={inputRef}
                                                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                                                        placeholder="Enter filename"
                                                    />
                                                </motion.div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        type="submit"
                                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                                    >
                                        Download
                                    </motion.button>
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        type="button"
                                        onClick={handleClose}
                                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                    >
                                        Cancel
                                    </motion.button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default DownloadModal;
