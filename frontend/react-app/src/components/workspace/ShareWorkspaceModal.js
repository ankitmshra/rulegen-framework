import React, { useState, useRef, useEffect } from 'react';
import { workspaceAPI, userAPI } from '../../services/api';
import { motion, AnimatePresence } from 'framer-motion';

const ShareWorkspaceModal = ({ workspace, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState('read');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [sharedUsers, setSharedUsers] = useState([]);
  const [isVisible, setIsVisible] = useState(true); // Track modal visibility
  
  const modalRef = useRef(null);
  const searchInputRef = useRef(null);
  
  // Load existing shares when component mounts
  useEffect(() => {
    if (workspace && workspace.shares) {
      setSharedUsers(workspace.shares);
    }
  }, [workspace]);

  useEffect(() => {
    // Focus on search input when modal opens
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }

    // Add event listener for clicking outside the modal
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        handleClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle close with animation
  const handleClose = () => {
    setIsVisible(false);
    // Delay actual onClose to allow animation to complete
    setTimeout(() => {
      onClose();
    }, 300); // Match animation duration
  };

  // Handle search input change
  const handleSearchChange = async (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    try {
      setIsSearching(true);
      const response = await userAPI.search(query);
      
      // Filter out users already in sharedUsers
      const filteredResults = response.data.filter(
        user => !sharedUsers.some(sharedUser => sharedUser.user_id === user.id)
      );
      
      setSearchResults(filteredResults);
    } catch (err) {
      console.error('Error searching users:', err);
      setError('Failed to search users');
    } finally {
      setIsSearching(false);
    }
  };

  // Handle share with user
  const handleShareWithUser = async (user) => {
    try {
      setIsSubmitting(true);
      setError(null);
      setSuccessMessage(null);
      
      const shareData = {
        workspace_id: workspace.id,
        username_or_email: user.username,
        permission: selectedPermission
      };
      
      const response = await workspaceAPI.share(shareData);
      
      // Add to sharedUsers list
      const newSharedUser = {
        user_id: user.id,
        username: user.username,
        email: user.email,
        permission: selectedPermission
      };
      
      setSharedUsers([...sharedUsers, newSharedUser]);
      setSearchResults([]);
      setSearchQuery('');
      setSuccessMessage(`Workspace shared with ${user.username} successfully`);
    } catch (err) {
      console.error('Error sharing workspace:', err);
      
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Failed to share workspace. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle remove share
  const handleRemoveShare = async (userId) => {
    try {
      setIsSubmitting(true);
      setError(null);
      setSuccessMessage(null);
      
      await workspaceAPI.removeShare({
        workspace_id: workspace.id,
        user_id: userId
      });
      
      // Remove from sharedUsers list
      const updatedSharedUsers = sharedUsers.filter(user => user.user_id !== userId);
      setSharedUsers(updatedSharedUsers);
      
      setSuccessMessage('User access removed successfully');
    } catch (err) {
      console.error('Error removing share:', err);
      
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Failed to remove user access. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

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
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                <div>
                  <div className="mt-3 text-center sm:mt-0 sm:text-left">
                    <motion.h3 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="text-lg leading-6 font-medium text-gray-900"
                    >
                      Share Workspace: {workspace.name}
                    </motion.h3>
                    <div className="mt-2">
                      <motion.p 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-sm text-gray-500"
                      >
                        Share this workspace with other users to collaborate on rules.
                      </motion.p>
                    </div>
                  </div>
                </div>

                {/* Alerts */}
                <AnimatePresence>
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" 
                      role="alert"
                    >
                      <span className="block sm:inline">{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                <AnimatePresence>
                  {successMessage && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative" 
                      role="alert"
                    >
                      <span className="block sm:inline">{successMessage}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Search and share section */}
                <div className="mt-5">
                  <label htmlFor="user-search" className="block text-sm font-medium text-gray-700">
                    Search users to share with
                  </label>
                  <div className="mt-1 flex rounded-md shadow-sm">
                    <div className="relative flex items-stretch flex-grow">
                      <input
                        type="text"
                        name="user-search"
                        id="user-search"
                        ref={searchInputRef}
                        value={searchQuery}
                        onChange={handleSearchChange}
                        className="focus:ring-indigo-500 focus:border-indigo-500 block w-full rounded-l-md sm:text-sm border-gray-300"
                        placeholder="Enter username or email"
                        disabled={isSubmitting}
                      />
                      {isSearching && (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                          <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="-ml-px relative">
                      <select
                        value={selectedPermission}
                        onChange={(e) => setSelectedPermission(e.target.value)}
                        className="focus:ring-indigo-500 focus:border-indigo-500 h-full py-0 pl-3 pr-7 border-gray-300 bg-transparent text-gray-500 sm:text-sm rounded-r-md"
                        disabled={isSubmitting}
                      >
                        <option value="read">Read Only</option>
                        <option value="write">Read & Write</option>
                      </select>
                    </div>
                  </div>
                  
                  {/* Search results */}
                  {searchResults.length > 0 && (
                    <div className="mt-2 border border-gray-200 rounded-md overflow-hidden">
                      <ul className="divide-y divide-gray-200 max-h-40 overflow-y-auto">
                        {searchResults.map(user => (
                          <li key={user.id} className="px-4 py-2 hover:bg-gray-50 flex justify-between items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{user.username}</div>
                              <div className="text-sm text-gray-500">{user.email}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleShareWithUser(user)}
                              disabled={isSubmitting}
                              className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                              Share
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Users with access */}
                <div className="mt-6">
                  <h4 className="text-md font-medium text-gray-700">Users with access</h4>
                  {sharedUsers.length === 0 ? (
                    <div className="mt-2 text-sm text-gray-500 bg-gray-50 p-4 rounded">
                      This workspace has not been shared with anyone yet.
                    </div>
                  ) : (
                    <ul className="mt-2 divide-y divide-gray-200 border border-gray-200 rounded-md">
                      {sharedUsers.map(user => (
                        <li key={user.user_id} className="px-4 py-3 flex justify-between items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{user.username}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                            <div className="mt-1">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                user.permission === 'write' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                              }`}>
                                {user.permission === 'write' ? 'Read & Write' : 'Read Only'}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveShare(user.user_id)}
                            disabled={isSubmitting}
                            className="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-red-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          >
                            <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <motion.button
                  type="button"
                  onClick={handleClose}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Done
                </motion.button>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ShareWorkspaceModal;
