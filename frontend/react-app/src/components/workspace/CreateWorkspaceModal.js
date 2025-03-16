import React, { useState, useRef, useEffect } from 'react';
import { workspaceAPI } from '../../services/api';

const CreateWorkspaceModal = ({ onClose, onWorkspaceCreated }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const modalRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    // Focus on name input when modal opens
    if (inputRef.current) {
      inputRef.current.focus();
    }

    // Add event listener for clicking outside the modal
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Workspace name is required');
      return;
    }

    if (name.length > 25) {
      setError('Workspace name cannot exceed 25 characters');
      return;
    }
    
    try {
      setIsSubmitting(true);
      setError(null);
      
      const workspaceData = {
        name,
        description,
        selected_headers: [] // Default empty array for headers
      };
      
      const response = await workspaceAPI.create(workspaceData);
      
      if (onWorkspaceCreated) {
        onWorkspaceCreated(response.data);
      }
    } catch (err) {
      console.error('Error creating workspace:', err);
      
      if (err.response?.data?.name) {
        // Backend validation error for name field
        setError(err.response.data.name[0]);
      } else if (err.response?.data?.non_field_errors) {
        // General backend validation error
        setError(err.response.data.non_field_errors[0]);
      } else {
        setError('Failed to create workspace. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div>
              <div className="mt-3 text-center sm:mt-0 sm:text-left">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Create New Workspace</h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    Create a new workspace to organize your SpamAssassin rules.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-5">
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                  <span className="block sm:inline">{error}</span>
                </div>
              )}
              
              <div className="mb-4">
                <label htmlFor="workspace-name" className="block text-sm font-medium text-gray-700">
                  Workspace Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="workspace-name"
                  id="workspace-name"
                  ref={inputRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                  placeholder="My Workspace"
                  maxLength={25}
                  required
                />
                <div className="mt-1 text-xs text-gray-500 flex justify-between">
                  <span>Max 25 characters</span>
                  <span>{name.length}/25</span>
                </div>
              </div>
              
              <div className="mb-4">
                <label htmlFor="workspace-description" className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  name="workspace-description"
                  id="workspace-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows="3"
                  className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                  placeholder="Optional description for this workspace"
                ></textarea>
              </div>
            </form>
          </div>
          
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm ${
                isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating...
                </>
              ) : (
                'Create Workspace'
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateWorkspaceModal;
