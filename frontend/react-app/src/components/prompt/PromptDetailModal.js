import React, { useState, useRef, useEffect } from 'react';
import { promptTemplateAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

const PromptDetailModal = ({ prompt, onClose, onPromptUpdated, onPromptDeleted, workspace }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(prompt.name);
  const [description, setDescription] = useState(prompt.description || '');
  const [template, setTemplate] = useState(prompt.template);
  const [visibility, setVisibility] = useState(prompt.visibility);
  const [moduleType, setModuleType] = useState(prompt.module_type || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [isVisible, setIsVisible] = useState(true); // Track modal visibility
  
  const { isPowerUser, isAdmin, currentUser } = useAuth();
  const modalRef = useRef(null);

  const canEdit = isAdmin() || isPowerUser() || prompt.created_by === currentUser?.id;
  const canDelete = isAdmin() || prompt.created_by === currentUser?.id;
  
  useEffect(() => {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Prompt name is required');
      return;
    }

    if (!template.trim()) {
      setError('Prompt template is required');
      return;
    }
    
    try {
      setIsSubmitting(true);
      setError(null);
      
      const promptData = {
        name,
        description,
        template,
        visibility,
        is_base: prompt.is_base,
        is_module: prompt.is_module,
        module_type: prompt.is_module ? moduleType : null,
        workspace: visibility === 'workspace' ? workspace?.id : null
      };
      
      const response = await promptTemplateAPI.update(prompt.id, promptData);
      
      if (onPromptUpdated) {
        onPromptUpdated(response.data);
      }
      
      setIsEditing(false);
    } catch (err) {
      console.error('Error updating prompt:', err);
      
      if (err.response?.data?.name) {
        setError(err.response.data.name[0]);
      } else if (err.response?.data?.non_field_errors) {
        setError(err.response.data.non_field_errors[0]);
      } else {
        setError('Failed to update prompt template. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this prompt template? This action cannot be undone.')) {
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      await promptTemplateAPI.delete(prompt.id);
      
      if (onPromptDeleted) {
        onPromptDeleted(prompt.id);
      }
    } catch (err) {
      console.error('Error deleting prompt:', err);
      setError('Failed to delete prompt template.');
      setIsSubmitting(false);
    }
  };

  // Module type options
  const moduleTypeOptions = [
    { value: 'scoring', label: 'Scoring' },
    { value: 'subrules', label: 'Meta Rules' },
    { value: 'notes', label: 'Notes' },
    { value: 'uri', label: 'URI Rules' },
    { value: 'html', label: 'HTML Content' },
    { value: 'custom', label: 'Custom' }
  ];

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
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div>
                  <div className="mt-3 text-center sm:mt-0 sm:text-left">
                    <motion.h3 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="text-lg leading-6 font-medium text-gray-900"
                    >
                      {isEditing ? 'Edit' : ''} {prompt.is_base ? 'Base Prompt' : prompt.is_module ? 'Prompt Module' : 'Workspace Prompt'}
                    </motion.h3>
                    
                    {/* Metadata bar */}
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="mt-2 flex flex-wrap gap-2"
                    >
                      {prompt.is_base && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-blue-100 text-blue-800">
                          Base
                        </span>
                      )}
                      {prompt.is_module && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-purple-100 text-purple-800">
                          Module: {prompt.module_type || 'Generic'}
                        </span>
                      )}
                      {prompt.visibility === 'global' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-green-100 text-green-800">
                          Global
                        </span>
                      )}
                      {prompt.visibility === 'user_workspaces' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-yellow-100 text-yellow-800">
                          User Workspaces
                        </span>
                      )}
                      {prompt.visibility === 'workspace' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-gray-100 text-gray-800">
                          Workspace
                        </span>
                      )}
                      {prompt.created_by_username && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-gray-100 text-gray-800">
                          Created by: {prompt.created_by_username}
                        </span>
                      )}
                    </motion.div>
                  </div>
                </div>

                <form className="mt-5">
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" 
                      role="alert"
                    >
                      <span className="block sm:inline">{error}</span>
                    </motion.div>
                  )}
                  
                  <div className="mb-4">
                    <label htmlFor="prompt-name" className="block text-sm font-medium text-gray-700">
                      Name {isEditing && <span className="text-red-500">*</span>}
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        name="prompt-name"
                        id="prompt-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        required
                      />
                    ) : (
                      <div className="mt-1 text-sm text-gray-900">{prompt.name}</div>
                    )}
                  </div>
                  
                  <div className="mb-4">
                    <label htmlFor="prompt-description" className="block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    {isEditing ? (
                      <textarea
                        name="prompt-description"
                        id="prompt-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows="2"
                        className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      ></textarea>
                    ) : (
                      <div className="mt-1 text-sm text-gray-700">
                        {prompt.description || <span className="text-gray-400 italic">No description</span>}
                      </div>
                    )}
                  </div>

                  {prompt.is_module && isEditing && (
                    <div className="mb-4">
                      <label htmlFor="module-type" className="block text-sm font-medium text-gray-700">
                        Module Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="module-type"
                        name="module-type"
                        value={moduleType}
                        onChange={(e) => setModuleType(e.target.value)}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                        required
                      >
                        <option value="">Select a module type</option>
                        {moduleTypeOptions.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  <div className="mb-4">
                    <label htmlFor="prompt-template" className="block text-sm font-medium text-gray-700">
                      Template {isEditing && <span className="text-red-500">*</span>}
                    </label>
                    {isEditing ? (
                      <textarea
                        name="prompt-template"
                        id="prompt-template"
                        value={template}
                        onChange={(e) => setTemplate(e.target.value)}
                        rows="10"
                        className="mt-1 font-mono focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        required
                      ></textarea>
                    ) : (
                      <div className="mt-1 text-sm text-gray-900 font-mono whitespace-pre-wrap bg-gray-50 p-3 rounded border border-gray-200 overflow-auto max-h-80">
                        {prompt.template}
                      </div>
                    )}
                  </div>

                  {/* Visibility selection (only show when editing for base prompts and modules if user is power user) */}
                  {isEditing && (isPowerUser() || !prompt.is_base && !prompt.is_module) && (
                    <div className="mb-4">
                      <label htmlFor="visibility" className="block text-sm font-medium text-gray-700">
                        Visibility
                      </label>
                      <select
                        id="visibility"
                        name="visibility"
                        value={visibility}
                        onChange={(e) => setVisibility(e.target.value)}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                      >
                        {isPowerUser() && (
                          <option value="global">Global (Available to All Users)</option>
                        )}
                        <option value="user_workspaces">My Workspaces (Available to All Your Workspaces)</option>
                        {workspace && (
                          <option value="workspace">This Workspace Only</option>
                        )}
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        {visibility === 'global' 
                          ? 'This prompt will be available to all users in the system.' 
                          : visibility === 'user_workspaces'
                            ? 'This prompt will be available in all your workspaces.'
                            : 'This prompt will only be available in the current workspace.'}
                      </p>
                    </div>
                  )}
                </form>
              </div>
              
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                {isEditing ? (
                  <>
                    <motion.button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm ${
                        isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
                      }`}
                      whileHover={!isSubmitting ? { scale: 1.05 } : {}}
                      whileTap={!isSubmitting ? { scale: 0.95 } : {}}
                    >
                      {isSubmitting ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Saving...
                        </>
                      ) : (
                        'Save Changes'
                      )}
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      disabled={isSubmitting}
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                      whileHover={!isSubmitting ? { scale: 1.05 } : {}}
                      whileTap={!isSubmitting ? { scale: 0.95 } : {}}
                    >
                      Cancel
                    </motion.button>
                  </>
                ) : (
                  <>
                    {canEdit && (
                      <motion.button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Edit
                      </motion.button>
                    )}
                    {canDelete && (
                      <motion.button
                        type="button"
                        onClick={handleDelete}
                        disabled={isSubmitting}
                        className="mt-3 w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                        whileHover={!isSubmitting ? { scale: 1.05 } : {}}
                        whileTap={!isSubmitting ? { scale: 0.95 } : {}}
                      >
                        {isSubmitting ? 'Deleting...' : 'Delete'}
                      </motion.button>
                    )}
                    <motion.button
                      type="button"
                      onClick={handleClose}
                      className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Close
                    </motion.button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default PromptDetailModal;
