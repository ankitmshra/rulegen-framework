import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

const MainLayout = () => {
  const { currentUser, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Admin settings state
  const [ruleGenTimeout, setRuleGenTimeout] = useState(30000);
  const [openaiApiEndpoint, setOpenaiApiEndpoint] = useState('https://api.sage.cudasvc.com');
  const [openaiApiVersion, setOpenaiApiVersion] = useState('');
  const [openaiModelName, setOpenaiModelName] = useState('deepseek-r1');
  const [openaiEmbeddingModelName, setOpenaiEmbeddingModelName] = useState('text-embedding-ada-002');
  const [openaiTeamName, setOpenaiTeamName] = useState('bci_ta');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [settingsError, setSettingsError] = useState('');
  
  // Model selector modal state
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const [availableModels, setAvailableModels] = useState([]);
  const [filteredModels, setFilteredModels] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const modelButtonRef = useRef(null);

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
  
  // Close model selector on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setIsModelSelectorOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  // Fetch available models
  const fetchAvailableModels = async () => {
    setIsLoadingModels(true);
    try {
      const response = await axios.get('/api/settings/openai-available-models/');
      setAvailableModels(response.data.models);
      setFilteredModels(response.data.models);
      setSettingsError('');
    } catch (error) {
      console.error('Error fetching available models:', error);
      setSettingsError('Failed to fetch available models');
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Load settings when panel opens
  useEffect(() => {
    if (isSettingsOpen && isAdmin()) {
      fetchSettings();
    }
  }, [isSettingsOpen]);

  // Fetch settings from API
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
      
      // Fetch available models if not already loaded
      if (availableModels.length === 0) {
        await fetchAvailableModels();
      }
      
      setSettingsError('');
    } catch (error) {
      console.error('Error fetching settings:', error);
      setSettingsError('Failed to load settings. Please try again.');
    }
  };

  // Save settings to API
  const handleSaveSettings = async () => {
    setIsSaving(true);
    setSaveMessage('');
    setSettingsError('');

    // Make sure we have the latest CSRF token
    axios.defaults.headers.common['X-CSRFToken'] = getCsrfToken();

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

    try {
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
        setSettingsError(`Some settings could not be saved: ${errorMessages.join(', ')}`);
      }

      if (successes.length > 0) {
        setSaveMessage(`${successes.length} settings saved successfully.`);
        setTimeout(() => setSaveMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setSettingsError('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      // Redirect happens in the logout function
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleSettingsClick = () => {
    setIsSettingsOpen(true);
    setIsProfileMenuOpen(false);
  };

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
    setIsModelSelectorOpen(false);
    setSaveMessage('');
    setSettingsError('');
    setSearchTerm('');
  };

  const toggleProfileMenu = () => {
    setIsProfileMenuOpen(!isProfileMenuOpen);
  };

  const navigateToWorkspaces = () => {
    navigate('/workspaces');
  };

  // Page transition variants
  const pageVariants = {
    initial: {
      opacity: 0,
      y: 10
    },
    in: {
      opacity: 1,
      y: 0
    },
    exit: {
      opacity: 0,
      y: -10
    }
  };

  // Settings panel variants
  const settingsPanelVariants = {
    hidden: {
      y: "100%",
      opacity: 0
    },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        damping: 25,
        stiffness: 300
      }
    },
    exit: {
      y: "100%",
      opacity: 0,
      transition: {
        type: "spring",
        damping: 30,
        stiffness: 300
      }
    }
  };

  const pageTransition = {
    type: "tween",
    ease: "easeInOut",
    duration: 0.3
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Left side - Logo */}
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link to="/workspaces" className="text-xl font-bold text-indigo-600">Codex</Link>
              </div>
            </div>

            {/* Right side - Workspace button, Settings and Profile */}
            <div className="flex items-center space-x-4">
              {/* Workspace Button */}
              <button
                onClick={navigateToWorkspaces}
                className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                title="Workspaces"
              >
                <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                </svg>
              </button>
              
              {/* Settings Button */}
              <motion.button
                onClick={handleSettingsClick}
                className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                title="Settings"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9, rotate: 90 }}
              >
                <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </motion.button>

              {/* Profile Dropdown */}
              <div className="relative">
                <div>
                  <motion.button
                    onClick={toggleProfileMenu}
                    className="max-w-xs bg-white flex items-center text-sm rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 p-2 focus:outline-none"
                    id="user-menu"
                    aria-expanded="false"
                    aria-haspopup="true"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    animate={isProfileMenuOpen ? { rotate: [0, 10, -10, 0] } : {}}
                    transition={{ duration: 0.5 }}
                  >
                    <span className="sr-only">Open user menu</span>
                    <div className="h-6 w-6 bg-indigo-600 text-white flex items-center justify-center">
                      {currentUser?.username?.charAt(0).toUpperCase()}
                    </div>
                  </motion.button>
                </div>

                {/* Profile Dropdown Menu with Animation */}
                <AnimatePresence>
                  {isProfileMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 bg-white ring-1 ring-black ring-opacity-5 focus:outline-none"
                      role="menu"
                      aria-orientation="vertical"
                      aria-labelledby="user-menu"
                    >
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="px-4 py-2 text-sm text-gray-700 border-b"
                      >
                        <div className="font-medium">{currentUser.username}</div>
                        <div className="text-gray-500">{currentUser.email}</div>
                        <div className="text-xs uppercase mt-1 text-indigo-600">{currentUser.role}</div>
                      </motion.div>

                      <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.15 }}
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-gray-100"
                        role="menuitem"
                        whileHover={{ backgroundColor: "rgba(243, 244, 246, 1)" }}
                      >
                        Logout
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content with AnimatePresence */}
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial="initial"
              animate="in"
              exit="exit"
              variants={pageVariants}
              transition={pageTransition}
              className="w-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Settings Panel */}
      <AnimatePresence>
        {isSettingsOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseSettings}
            />

            {/* Settings Panel */}
            <motion.div 
              className="fixed inset-x-0 bottom-0 bg-white rounded-t-2xl shadow-lg z-50 max-h-[90vh] overflow-y-auto"
              variants={settingsPanelVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <div className="sticky top-0 bg-white p-4 border-b flex justify-between items-center">
                <h2 className="text-lg font-semibold">Settings</h2>
                <motion.button
                  onClick={handleCloseSettings}
                  className="p-2 rounded-full text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9, rotate: 90 }}
                >
                  <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </motion.button>
              </div>

              <div className="p-4">
                {/* Settings content */}
                <div className="space-y-6">
                  {/* Account Settings Section */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Account Settings</h3>
                    <div className="mt-4 bg-white shadow overflow-hidden sm:rounded-lg">
                      <div className="px-4 py-5 sm:px-6">
                        <h3 className="text-md font-medium text-gray-900">User Profile</h3>
                      </div>
                      <div className="border-t border-gray-200">
                        <dl>
                          <div className="bg-gray-50 px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500">Username</dt>
                            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{currentUser.username}</dd>
                          </div>
                          <div className="bg-white px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500">Email address</dt>
                            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{currentUser.email}</dd>
                          </div>
                          <div className="bg-gray-50 px-4 py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                            <dt className="text-sm font-medium text-gray-500">User role</dt>
                            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800">
                                {currentUser.role}
                              </span>
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  </div>

                  {/* Password Section */}
                  <div className="bg-white shadow sm:rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                      <h3 className="text-md font-medium text-gray-900">Password</h3>
                      <div className="mt-2 max-w-xl text-sm text-gray-500">
                        <p>Change your password or update your security settings.</p>
                      </div>
                      <div className="mt-5">
                        <button
                          type="button"
                          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          Change password
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Admin Settings Section (if admin user) */}
                  {isAdmin() && (
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">Admin Settings</h3>
                      
                      {/* User Management */}
                      <div className="mt-4 bg-white shadow overflow-hidden sm:rounded-lg">
                        <div className="px-4 py-5 sm:p-6">
                          <h3 className="text-md font-medium text-gray-900">User Management</h3>
                          <div className="mt-2 max-w-xl text-sm text-gray-500">
                            <p>Manage users, assign roles, and control access to the system.</p>
                          </div>
                          <div className="mt-5">
                            <button
                              onClick={() => {
                                navigate('/admin/users');
                                handleCloseSettings();
                              }}
                              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                              Go to User Management
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Rule Generation Settings */}
                      <div className="mt-4 bg-white shadow overflow-hidden sm:rounded-lg">
                        <div className="px-4 py-5 sm:p-6">
                          <h3 className="text-md font-medium text-gray-900">Rule Generation Settings</h3>
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
                      
                      {/* OpenAI API Settings */}
                      <div className="mt-4 bg-white shadow overflow-hidden sm:rounded-lg">
                        <div className="px-4 py-5 sm:p-6">
                          <h3 className="text-md font-medium text-gray-900">OpenAI API Settings</h3>
                          <div className="mt-2 max-w-xl text-sm text-gray-500">
                            <p>Configure the OpenAI API settings for rule generation.</p>
                          </div>
                          
                          <div className="mt-5 space-y-4">
                            {/* API Endpoint */}
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
                            </div>
                            
                            {/* API Version */}
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
                            </div>
                            
                            {/* Model Name */}
                            <div className="max-w-md">
                              <label htmlFor="model" className="block text-sm font-medium text-gray-700">
                                Model Name
                              </label>
                              <div className="mt-1">
                                <div className="relative">
                                  <button
                                    type="button"
                                    ref={modelButtonRef}
                                    onClick={() => {
                                      setIsModelSelectorOpen(true);
                                      // Fetch models if not already loaded
                                      if (availableModels.length === 0) {
                                        fetchAvailableModels();
                                      }
                                    }}
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
                            
                            {/* Embedding Model */}
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
                            </div>
                            
                            {/* Team Name */}
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
                            </div>
                          </div>
                          
                          {/* Save settings button */}
                          <div className="mt-5">
                            {settingsError && (
                              <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
                                <strong className="font-bold">Error: </strong>
                                <span className="block sm:inline">{settingsError}</span>
                              </div>
                            )}
                            
                            <div className="flex justify-end">
                              <button
                                onClick={handleSaveSettings}
                                disabled={isSaving}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                              >
                                {isSaving ? 'Saving...' : 'Save Settings'}
                              </button>
                              {saveMessage && (
                                <span className="ml-3 text-sm text-green-600">
                                  {saveMessage}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            &copy; {new Date().getFullYear()} Codex - Generate SpamAssassin Rules
          </p>
        </div>
      </footer>

      {/* Model Selection Modal */}
      <AnimatePresence>
        {isModelSelectorOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
              className="fixed inset-0 bg-black bg-opacity-50 z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModelSelectorOpen(false)}
            />

            {/* Modal */}
            <motion.div 
              className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div 
                className="inline-block bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full"
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
              >
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
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            <svg
                              className={`h-3.5 w-3.5 mr-2 flex-shrink-0 ${isLoadingModels ? 'animate-spin' : ''}`}
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
                            <span>{isLoadingModels ? 'Refreshing...' : 'Refresh Models'}</span>
                          </button>
                        </div>
                        <div className="mt-4 max-h-60 overflow-y-auto">
                          {isLoadingModels ? (
                            <div className="px-3 py-2 text-sm text-gray-500">Loading models...</div>
                          ) : filteredModels.length > 0 ? (
                            filteredModels.map(model => (
                              <button
                                key={model}
                                className={`w-full text-left px-3 py-2.5 text-sm ${
                                  model === openaiModelName
                                    ? 'bg-indigo-100 text-indigo-900'
                                    : 'text-gray-900 hover:bg-gray-100'
                                }`}
                                onClick={() => {
                                  setOpenaiModelName(model);
                                  setIsModelSelectorOpen(false);
                                }}
                              >
                                {model}
                              </button>
                            ))
                          ) : searchTerm ? (
                            <div className="px-3 py-2 text-sm text-gray-500">No matching models found</div>
                          ) : (
                            <div className="px-3 py-2 text-sm text-gray-500">No models available</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={() => setIsModelSelectorOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MainLayout;
