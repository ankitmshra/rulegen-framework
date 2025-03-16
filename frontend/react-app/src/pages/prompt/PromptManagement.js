import React, { useState, useEffect } from 'react';
import { promptTemplateAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import CreatePromptModal from '../../components/prompt/CreatePromptModal';
import PromptDetailModal from '../../components/prompt/PromptDetailModal';

const PromptManagement = ({ workspace }) => {
  const [basePrompts, setBasePrompts] = useState([]);
  const [modulePrompts, setModulePrompts] = useState([]);
  const [workspacePrompts, setWorkspacePrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [promptType, setPromptType] = useState('base'); // 'base', 'module', or 'workspace'
  
  const { isPowerUser } = useAuth();

  useEffect(() => {
    fetchPrompts();
  }, [workspace?.id]);

  const fetchPrompts = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all prompts
      const response = await promptTemplateAPI.getAll();
      const allPrompts = response.data;

      // Filter and categorize prompts
      setBasePrompts(allPrompts.filter(prompt => prompt.is_base));
      setModulePrompts(allPrompts.filter(prompt => prompt.is_module));
      
      // Workspace-specific prompts
      if (workspace) {
        setWorkspacePrompts(allPrompts.filter(prompt => 
          !prompt.is_base && 
          !prompt.is_module && 
          prompt.workspace === workspace.id
        ));
      } else {
        setWorkspacePrompts([]);
      }
    } catch (err) {
      console.error('Error fetching prompts:', err);
      setError('Failed to load prompts');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = (type) => {
    setPromptType(type);
    setShowCreateModal(true);
  };

  const handlePromptCreated = (newPrompt) => {
    // Update the appropriate list based on prompt type
    if (newPrompt.is_base) {
      setBasePrompts([...basePrompts, newPrompt]);
    } else if (newPrompt.is_module) {
      setModulePrompts([...modulePrompts, newPrompt]);
    } else if (newPrompt.workspace === workspace?.id) {
      setWorkspacePrompts([...workspacePrompts, newPrompt]);
    }

    setShowCreateModal(false);
  };

  const handleViewPrompt = (prompt) => {
    setSelectedPrompt(prompt);
    setShowDetailModal(true);
  };

  const handlePromptUpdated = (updatedPrompt) => {
    // Update the appropriate list
    if (updatedPrompt.is_base) {
      setBasePrompts(basePrompts.map(p => p.id === updatedPrompt.id ? updatedPrompt : p));
    } else if (updatedPrompt.is_module) {
      setModulePrompts(modulePrompts.map(p => p.id === updatedPrompt.id ? updatedPrompt : p));
    } else if (updatedPrompt.workspace === workspace?.id) {
      setWorkspacePrompts(workspacePrompts.map(p => p.id === updatedPrompt.id ? updatedPrompt : p));
    }
  };

  const handlePromptDeleted = (promptId) => {
    // Remove from the appropriate list
    setBasePrompts(basePrompts.filter(p => p.id !== promptId));
    setModulePrompts(modulePrompts.filter(p => p.id !== promptId));
    setWorkspacePrompts(workspacePrompts.filter(p => p.id !== promptId));
    setShowDetailModal(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-medium text-gray-900">Prompt Templates</h2>
        <p className="mt-1 text-sm text-gray-500">
          Manage your prompt templates for generating SpamAssassin rules
        </p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Base Prompts Section */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium leading-6 text-gray-900">Base Prompts</h3>
              <button
                onClick={() => handleOpenCreateModal('base')}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <svg className="-ml-0.5 mr-1 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create
              </button>
            </div>
            <div className="border-t border-gray-200 pt-4">
              {basePrompts.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No base prompts available</p>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {basePrompts.map((prompt) => (
                    <li key={prompt.id} className="py-3">
                      <button
                        onClick={() => handleViewPrompt(prompt)}
                        className="block w-full text-left hover:bg-gray-50 p-2 rounded"
                      >
                        <div className="text-sm font-medium text-indigo-600">{prompt.name}</div>
                        <div className="text-xs text-gray-500 truncate">{prompt.description || 'No description'}</div>
                        <div className="mt-1 flex">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            Base
                          </span>
                          {prompt.visibility === 'global' && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              Global
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Module Prompts Section */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium leading-6 text-gray-900">Prompt Modules</h3>
              <button
                onClick={() => handleOpenCreateModal('module')}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <svg className="-ml-0.5 mr-1 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create
              </button>
            </div>
            <div className="border-t border-gray-200 pt-4">
              {modulePrompts.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No prompt modules available</p>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {modulePrompts.map((prompt) => (
                    <li key={prompt.id} className="py-3">
                      <button
                        onClick={() => handleViewPrompt(prompt)}
                        className="block w-full text-left hover:bg-gray-50 p-2 rounded"
                      >
                        <div className="text-sm font-medium text-indigo-600">{prompt.name}</div>
                        <div className="text-xs text-gray-500 truncate">{prompt.description || 'No description'}</div>
                        <div className="mt-1 flex">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                            Module: {prompt.module_type || 'Generic'}
                          </span>
                          {prompt.visibility === 'global' && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              Global
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Workspace Prompts Section */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium leading-6 text-gray-900">Workspace Prompts</h3>
              <button
                onClick={() => handleOpenCreateModal('workspace')}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <svg className="-ml-0.5 mr-1 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create
              </button>
            </div>
            <div className="border-t border-gray-200 pt-4">
              {workspacePrompts.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No workspace prompts available</p>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {workspacePrompts.map((prompt) => (
                    <li key={prompt.id} className="py-3">
                      <button
                        onClick={() => handleViewPrompt(prompt)}
                        className="block w-full text-left hover:bg-gray-50 p-2 rounded"
                      >
                        <div className="text-sm font-medium text-indigo-600">{prompt.name}</div>
                        <div className="text-xs text-gray-500 truncate">{prompt.description || 'No description'}</div>
                        <div className="mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                            Workspace
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Prompt Modal */}
      {showCreateModal && (
        <CreatePromptModal
          onClose={() => setShowCreateModal(false)}
          onPromptCreated={handlePromptCreated}
          promptType={promptType}
          workspace={workspace}
        />
      )}

      {/* Prompt Detail Modal */}
      {showDetailModal && selectedPrompt && (
        <PromptDetailModal
          prompt={selectedPrompt}
          onClose={() => setShowDetailModal(false)}
          onPromptUpdated={handlePromptUpdated}
          onPromptDeleted={handlePromptDeleted}
          workspace={workspace}
        />
      )}
    </div>
  );
};

export default PromptManagement;
