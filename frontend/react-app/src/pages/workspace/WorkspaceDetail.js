import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, Routes, Route } from 'react-router-dom';
import { workspaceAPI } from '../../services/api';
import PromptManagement from '../prompt/PromptManagement';
import RuleGeneration from '../rule/RuleGeneration';
import ShareWorkspaceModal from '../../components/workspace/ShareWorkspaceModal';

const WorkspaceDetail = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('rule-generation');
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    const fetchWorkspace = async () => {
      try {
        setLoading(true);
        const response = await workspaceAPI.getById(workspaceId);
        setWorkspace(response.data);
        
        // Check if a tab is stored in localStorage
        const storedTab = localStorage.getItem(`workspace_${workspaceId}_tab`);
        if (storedTab) {
          setActiveTab(storedTab);
        }
      } catch (err) {
        console.error('Error fetching workspace:', err);
        setError('Failed to load workspace');
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspace();
  }, [workspaceId]);

  // Handle tab change
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    // Store in localStorage
    localStorage.setItem(`workspace_${workspaceId}_tab`, tab);
    
    // Update URL without full page reload
    if (tab === 'prompt-management') {
      navigate(`/workspaces/${workspaceId}/prompts`);
    } else {
      navigate(`/workspaces/${workspaceId}/rules`);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
        <strong className="font-bold">Error!</strong>
        <span className="block sm:inline"> {error}</span>
        <div className="mt-3">
          <Link
            to="/workspaces"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Return to Workspaces
          </Link>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative" role="alert">
        <strong className="font-bold">Workspace not found!</strong>
        <span className="block sm:inline"> The requested workspace could not be found.</span>
        <div className="mt-3">
          <Link
            to="/workspaces"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Return to Workspaces
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg">
      {/* Workspace Header */}
      <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center">
        <div>
          <div className="flex items-center">
            <h1 className="text-2xl font-semibold text-gray-900">{workspace.name}</h1>
            <Link
              to="/workspaces"
              className="ml-4 text-sm text-indigo-600 hover:text-indigo-500"
            >
              All Workspaces
            </Link>
          </div>
          {workspace.description && (
            <p className="mt-1 text-sm text-gray-500">{workspace.description}</p>
          )}
        </div>
        <div>
          <button
            onClick={() => setShowShareModal(true)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <svg className="-ml-1 mr-2 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex px-6">
          <button
            onClick={() => handleTabChange('rule-generation')}
            className={`${
              activeTab === 'rule-generation'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } flex-1 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm text-center`}
          >
            Rule Generation
          </button>
          <button
            onClick={() => handleTabChange('prompt-management')}
            className={`${
              activeTab === 'prompt-management'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } flex-1 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm text-center`}
          >
            Prompt Management
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="px-6 py-5">
        {activeTab === 'rule-generation' && <RuleGeneration workspace={workspace} />}
        {activeTab === 'prompt-management' && <PromptManagement workspace={workspace} />}
      </div>

      {/* Share Workspace Modal */}
      {showShareModal && (
        <ShareWorkspaceModal
          workspace={workspace}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
};

export default WorkspaceDetail;
