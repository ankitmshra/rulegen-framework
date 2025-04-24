import React, { useState, useEffect } from 'react';

const HeaderSelector = ({ availableHeaders, selectedHeaders, onSelectHeaders, onContinue, onBack }) => {
  const [localSelectedHeaders, setLocalSelectedHeaders] = useState(selectedHeaders || []);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Update local state when selectedHeaders prop changes
  useEffect(() => {
    setLocalSelectedHeaders(selectedHeaders);
  }, [selectedHeaders]);

  // Common headers that are typically useful for spam detection
  const commonSpamHeaders = [
    'From',
    'To',
    'Subject',
    'Date',
    'Reply-To',
    'Return-Path',
    'Received',
    'X-Mailer',
    'X-Originating-IP',
    'X-Spam-Status',
    'DKIM-Signature',
    'SPF',
    'Message-ID',
    'Content-Type',
    'X-Priority'
  ];

  // Toggle header selection
  const toggleHeader = (header) => {
    if (localSelectedHeaders.includes(header)) {
      setLocalSelectedHeaders(localSelectedHeaders.filter(h => h !== header));
    } else {
      setLocalSelectedHeaders([...localSelectedHeaders, header]);
    }
  };

  // Select all headers
  const selectAllHeaders = () => {
    setLocalSelectedHeaders(Object.keys(availableHeaders));
  };

  // Select only common spam headers
  const selectCommonHeaders = () => {
    const availableCommonHeaders = commonSpamHeaders.filter(header => 
      Object.keys(availableHeaders).includes(header)
    );
    setLocalSelectedHeaders(availableCommonHeaders);
  };

  // Clear all selected headers
  const clearSelection = () => {
    setLocalSelectedHeaders([]);
  };

  // Continue to next step
  const handleContinue = () => {
    onSelectHeaders(localSelectedHeaders);
    onContinue(localSelectedHeaders);
  };

  // Filter headers based on search term
  const filteredHeaders = Object.keys(availableHeaders).filter(header => 
    header.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="px-6 py-5">
      <h3 className="text-lg font-medium text-gray-900 mb-2">Select Email Headers</h3>
      <p className="text-sm text-gray-500 mb-6">
        Choose which email headers to include in the rule generation process.
      </p>

      <div className="mb-4">
        <div className="flex justify-between mb-2">
          <div className="relative flex-1 max-w-xs">
            <input
              type="text"
              className="w-full pl-12 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Search headers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={selectCommonHeaders}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Common Headers
            </button>
            <button
              type="button"
              onClick={selectAllHeaders}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={clearSelection}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Clear All
            </button>
          </div>
        </div>
        <div className="text-sm text-gray-500 mb-2">
          {localSelectedHeaders.length} header(s) selected
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <div className="max-h-80 overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    checked={localSelectedHeaders.length === Object.keys(availableHeaders).length}
                    onChange={e => e.target.checked ? selectAllHeaders() : clearSelection()}
                  />
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Header Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Example Value
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Common for Spam?
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredHeaders.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">
                    No headers found matching your search
                  </td>
                </tr>
              ) : (
                filteredHeaders.map(header => (
                  <tr 
                    key={header} 
                    className={`${localSelectedHeaders.includes(header) ? 'bg-indigo-50' : 'hover:bg-gray-50'} cursor-pointer`}
                    onClick={() => toggleHeader(header)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        checked={localSelectedHeaders.includes(header)}
                        onChange={() => toggleHeader(header)}
                        onClick={e => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{header}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500 truncate max-w-xs">
                        {availableHeaders[header]}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {commonSpamHeaders.includes(header) ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Yes
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                          No
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <svg className="mr-2 -ml-1 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Upload
        </button>
        
        <button
          type="button"
          onClick={handleContinue}
          disabled={localSelectedHeaders.length === 0}
          className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
            localSelectedHeaders.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          Continue to Prompt Configuration
          <svg className="ml-2 -mr-1 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default HeaderSelector;
