import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { createPortal } from 'react-dom';

const AppSettings = () => {
  const [ruleGenTimeout, setRuleGenTimeout] = useState(30000); // Default 30 seconds
  const [openaiApiEndpoint, setOpenaiApiEndpoint] = useState('https://api.sage.cudasvc.com');
  const [openaiApiVersion, setOpenaiApiVersion] = useState('');
  const [openaiModelName, setOpenaiModelName] = useState('deepseek-r1');
  const [openaiEmbeddingModelName, setOpenaiEmbeddingModelName] = useState('text-embedding-ada-002');
  const [openaiTeamName, setOpenaiTeamName] = useState('bci_ta');
  const [availableModels, setAvailableModels] = useState([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [error, setError] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredModels, setFilteredModels] = useState([]);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef(null);

  // Update dropdown position when button position changes
  useEffect(() => {
    if (buttonRef.current && isDropdownOpen) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [isDropdownOpen]);

  // Get CSRF token from cookie
  const getCsrfToken = () => {
    const name = 'csrftoken';
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
      const cookies = document.cookie.split(';');
      for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.substring(0, name.length + 1) === (name + '=')) {
          cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
          break;
        }
      }
    }
    return cookieValue;
  };

  // Configure axios defaults
  useEffect(() => {
    axios.defaults.headers.common['X-CSRFToken'] = getCsrfToken();
    axios.defaults.withCredentials = true;
  }, []);

  // Update filtered models when available models or search term changes
  useEffect(() => {
    if (searchTerm) {
      const filtered = availableModels.filter(model =>
        model.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredModels(filtered);
    } else {
      setFilteredModels(availableModels);
    }
  }, [availableModels, searchTerm]);

  // Cleanup function for modals
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    };

    const handleClickOutside = (e) => {
      if (isDropdownOpen) {
        const modal = document.querySelector('.modal-content');
        if (modal && !modal.contains(e.target)) {
          setIsDropdownOpen(false);
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Fetch available models
  const fetchAvailableModels = async () => {
    setIsLoadingModels(true);
    try {
      const response = await axios.get('/api/settings/openai-available-models/');
      setAvailableModels(response.data.models);
      setFilteredModels(response.data.models);
      setError(''); // Clear any previous errors
    } catch (error) {
      console.error('Error fetching available models:', error);
      const errorMessage = error.response?.data?.error || 'Failed to fetch available models. Please try again.';
      setError(`Error fetching models: ${errorMessage}`);
    } finally {
      setIsLoadingModels(false);
    }
  };

  useEffect(() => {
    // Load saved settings when component mounts
    const fetchSettings = async () => {
      try {
        const [timeoutResponse, endpointResponse, versionResponse, modelResponse, embeddingModelResponse, teamResponse] = await Promise.all([
          axios.get('/api/settings/rule-gen-timeout/'),
          axios.get('/api/settings/openai-api-endpoint/'),
          axios.get('/api/settings/openai-api-version/'),
          axios.get('/api/settings/openai-model-name/'),
          axios.get('/api/settings/openai-embedding-model-name/'),
          axios.get('/api/settings/openai-team-name/')
        ]);
        
        if (timeoutResponse.data.timeout) {
          setRuleGenTimeout(timeoutResponse.data.timeout);
        }
        if (endpointResponse.data.endpoint) {
          setOpenaiApiEndpoint(endpointResponse.data.endpoint);
        }
        if (versionResponse.data.version) {
          setOpenaiApiVersion(versionResponse.data.version);
        }
        if (modelResponse.data.model) {
          setOpenaiModelName(modelResponse.data.model);
        }
        if (embeddingModelResponse.data.model) {
          setOpenaiEmbeddingModelName(embeddingModelResponse.data.model);
        }
        if (teamResponse.data.team) {
          setOpenaiTeamName(teamResponse.data.team);
        }

        // Fetch available models after loading settings
        await fetchAvailableModels();
      } catch (error) {
        console.error('Error fetching settings:', error);
        if (error.response?.status === 403) {
          setError('You do not have permission to access these settings. Please contact an administrator.');
        } else if (error.response?.status === 401) {
          setError('Please log in to access these settings.');
        } else {
          setError('Error loading settings. Please try again.');
        }
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');
    setError('');

    const settings = [
      {
        endpoint: '/api/settings/rule-gen-timeout/',
        data: { timeout: ruleGenTimeout },
        name: 'Timeout'
      },
      {
        endpoint: '/api/settings/openai-api-endpoint/',
        data: { endpoint: openaiApiEndpoint },
        name: 'API Endpoint'
      },
      {
        endpoint: '/api/settings/openai-api-version/',
        data: { version: openaiApiVersion },
        name: 'API Version'
      },
      {
        endpoint: '/api/settings/openai-model-name/',
        data: { model: openaiModelName },
        name: 'Model Name'
      },
      {
        endpoint: '/api/settings/openai-embedding-model-name/',
        data: { model: openaiEmbeddingModelName },
        name: 'Embedding Model Name'
      },
      {
        endpoint: '/api/settings/openai-team-name/',
        data: { team: openaiTeamName },
        name: 'Team Name'
      }
    ];

    const results = await Promise.allSettled(
      settings.map(setting => 
        axios.post(setting.endpoint, setting.data)
          .then(response => ({ ...setting, success: true, response }))
          .catch(error => ({ ...setting, success: false, error }))
      )
    );

    const failures = results.filter(result => !result.value.success);
    const successes = results.filter(result => result.value.success);

    if (failures.length > 0) {
      const errorMessages = failures.map(failure => 
        `${failure.value.name}: ${failure.value.error.response?.data?.error || 'Failed to save'}`
      );
      setError(`Some settings could not be saved:\n${errorMessages.join('\n')}`);
    }

    if (successes.length > 0) {
      setSaveMessage(`${successes.length} settings saved successfully.`);
      setTimeout(() => setSaveMessage(''), 3000);
    }

    setIsSaving(false);
  };

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
        <strong className="font-bold">Error: </strong>
        <span className="block sm:inline">{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Rule Generation Settings</h3>
          <div className="mt-2 max-w-xl text-sm text-gray-500">
            <p>Configure timeout settings for rule generation process.</p>
          </div>
          <div className="mt-5">
            <div className="max-w-md">
              <label htmlFor="timeout" className="block text-sm font-medium text-gray-700">
                Rule Generation Timeout (milliseconds)
              </label>
              <div className="mt-1">
                <input
                  type="number"
                  name="timeout"
                  id="timeout"
                  min="1000"
                  step="1000"
                  value={ruleGenTimeout}
                  onChange={(e) => setRuleGenTimeout(parseInt(e.target.value))}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Set the maximum time to wait for rule generation (minimum 1000ms recommended).
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">OpenAI API Settings</h3>
          <div className="mt-2 max-w-xl text-sm text-gray-500">
            <p>Configure the OpenAI API settings for rule generation.</p>
          </div>
          <div className="mt-5 space-y-4">
            <div className="max-w-md">
              <label htmlFor="endpoint" className="block text-sm font-medium text-gray-700">
                API Endpoint URL
              </label>
              <div className="mt-1">
                <input
                  type="url"
                  name="endpoint"
                  id="endpoint"
                  value={openaiApiEndpoint}
                  onChange={(e) => setOpenaiApiEndpoint(e.target.value)}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder="https://api.sage.cudasvc.com"
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                The URL of the OpenAI API endpoint to use for rule generation.
              </p>
            </div>

            <div className="max-w-md">
              <label htmlFor="version" className="block text-sm font-medium text-gray-700">
                API Version
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  name="version"
                  id="version"
                  value={openaiApiVersion}
                  onChange={(e) => setOpenaiApiVersion(e.target.value)}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder="2023-05-15"
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                The version of the OpenAI API to use.
              </p>
            </div>

            <div className="max-w-md">
              <label htmlFor="model" className="block text-sm font-medium text-gray-700">
                Model Name
              </label>
              <div className="mt-1">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(true)}
                    className="w-full bg-white border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-left focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <span className="block truncate">
                      {openaiModelName || 'Select a model'}
                    </span>
                    <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </span>
                  </button>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Click to select a model from the available options.
                </p>
              </div>
            </div>

            <div className="max-w-md">
              <label htmlFor="embedding-model" className="block text-sm font-medium text-gray-700">
                Embedding Model Name
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  name="embedding-model"
                  id="embedding-model"
                  value={openaiEmbeddingModelName}
                  onChange={(e) => setOpenaiEmbeddingModelName(e.target.value)}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder="text-embedding-ada-002"
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Enter the name of the embedding model to use.
              </p>
            </div>

            <div className="max-w-md">
              <label htmlFor="team" className="block text-sm font-medium text-gray-700">
                Team Name
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  name="team"
                  id="team"
                  value={openaiTeamName}
                  onChange={(e) => setOpenaiTeamName(e.target.value)}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder="bci_ta"
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                The team name to use for API authentication.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
        {saveMessage && (
          <span className={`ml-3 text-sm ${saveMessage.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
            {saveMessage}
          </span>
        )}
      </div>

      {/* Model Selection Modal */}
      {isDropdownOpen && (
        <div className="fixed inset-0 z-[9999] overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full modal-content">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Select Model
                    </h3>
                    <div className="mt-4">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search models..."
                          className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                          <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                      </div>
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={fetchAvailableModels}
                          disabled={isLoadingModels}
                          className="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          <svg
                            className={`h-4 w-4 mr-1 ${isLoadingModels ? 'animate-spin' : ''}`}
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                          {isLoadingModels ? 'Refreshing...' : 'Refresh'}
                        </button>
                      </div>
                      <div className="mt-4 max-h-60 overflow-y-auto">
                        {isLoadingModels ? (
                          <div className="px-3 py-2 text-sm text-gray-500">Loading models...</div>
                        ) : filteredModels.length > 0 ? (
                          filteredModels.map(model => (
                            <button
                              key={model}
                              className={`w-full text-left px-3 py-2 text-sm ${
                                model === openaiModelName
                                  ? 'bg-indigo-100 text-indigo-900'
                                  : 'text-gray-900 hover:bg-gray-100'
                              }`}
                              onClick={() => {
                                setOpenaiModelName(model);
                                setIsDropdownOpen(false);
                              }}
                            >
                              {model}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-sm text-gray-500">No models found</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setIsDropdownOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppSettings; 