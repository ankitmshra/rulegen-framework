import { useState, useEffect } from 'react';
import api from '../../api';

function HeaderSelection({ emailFiles, selectedHeaders, setSelectedHeaders, goToNextStep, goToPreviousStep }) {
    const [availableHeaders, setAvailableHeaders] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [selectAll, setSelectAll] = useState(false);

    useEffect(() => {
        fetchAvailableHeaders();
    }, [emailFiles]);

    useEffect(() => {
        // Check if all headers are selected
        if (Object.keys(availableHeaders).length > 0 &&
            selectedHeaders.length === Object.keys(availableHeaders).length) {
            setSelectAll(true);
        } else {
            setSelectAll(false);
        }
    }, [selectedHeaders, availableHeaders]);

    const fetchAvailableHeaders = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/api/email-files/available_headers/');
            setAvailableHeaders(response.data);
        } catch (error) {
            console.error('Error fetching available headers:', error);
            alert('Failed to load email headers. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleHeaderChange = (header, isChecked) => {
        if (isChecked) {
            setSelectedHeaders(prev => [...prev, header]);
        } else {
            setSelectedHeaders(prev => prev.filter(h => h !== header));
        }
    };

    const handleSelectAll = (isChecked) => {
        setSelectAll(isChecked);
        if (isChecked) {
            setSelectedHeaders(Object.keys(availableHeaders));
        } else {
            setSelectedHeaders([]);
        }
    };

    return (
        <div>
            <h2 className="text-xl font-semibold mb-4">Select Email Headers to Analyze</h2>

            {isLoading ? (
                <div className="flex justify-center items-center p-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    <p className="ml-3">Loading headers...</p>
                </div>
            ) : (
                <>
                    <div className="mb-4 flex items-center">
                        <input
                            type="checkbox"
                            id="select-all-headers"
                            className="rounded text-indigo-600 focus:ring-indigo-500 mr-2"
                            checked={selectAll}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                        />
                        <label htmlFor="select-all-headers" className="font-medium">
                            Select All Headers
                        </label>
                    </div>

                    <div className="border rounded-lg p-4 max-h-96 overflow-y-auto mb-6">
                        {Object.keys(availableHeaders).length === 0 ? (
                            <p className="text-gray-500 py-3">No headers found in the uploaded emails</p>
                        ) : (
                            <div className="space-y-3">
                                {Object.entries(availableHeaders).map(([header, example]) => (
                                    <div key={header} className="flex items-start space-x-3">
                                        <input
                                            type="checkbox"
                                            id={`header-${header}`}
                                            className="rounded text-indigo-600 focus:ring-indigo-500 mt-1"
                                            checked={selectedHeaders.includes(header)}
                                            onChange={(e) => handleHeaderChange(header, e.target.checked)}
                                        />
                                        <div>
                                            <label htmlFor={`header-${header}`} className="font-medium cursor-pointer">
                                                {header}
                                            </label>
                                            <div className="text-sm text-gray-500 mt-1">{example}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-6">
                <button
                    onClick={goToPreviousStep}
                    className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 transition-colors"
                >
                    Back: Upload Files
                </button>
                <button
                    onClick={goToNextStep}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    disabled={selectedHeaders.length === 0}
                >
                    Next: Generate Rules
                </button>
            </div>
        </div>
    );
}

export default HeaderSelection;
