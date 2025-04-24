import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { workspaceAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import CreateWorkspaceModal from '../../components/workspace/CreateWorkspaceModal';
import ShareWorkspaceModal from '../../components/workspace/ShareWorkspaceModal';

const WorkspaceList = () => {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [activeTab, setActiveTab] = useState('my-workspaces');
  
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Check if we should show the create modal from navigation state
  useEffect(() => {
    if (location.state?.showCreateModal) {
      // Set timeout to ensure component is fully mounted
      setTimeout(() => {
        setShowCreateModal(true);
        // Clear the state
        navigate(location.pathname, { replace: true, state: {} });
      }, 100);
    }
  }, [location, navigate]);

  // Fetch workspaces
  useEffect(() => {
    const fetchWorkspaces = async () => {
      try {
        setLoading(true);
        const response = await workspaceAPI.getSummary();
        setWorkspaces(response.data);
      } catch (err) {
        console.error('Error fetching workspaces:', err);
        setError('Failed to load workspaces');
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspaces();
  }, []);

  // Handle workspace creation
  const handleWorkspaceCreated = (newWorkspace) => {
    setWorkspaces([newWorkspace, ...workspaces]);
    setShowCreateModal(false);
  };

  // Handle workspace deletion
  const handleDeleteWorkspace = async (id) => {
    if (!window.confirm('Are you sure you want to delete this workspace? This action cannot be undone.')) {
      return;
    }

    try {
      await workspaceAPI.delete(id);
      setWorkspaces(workspaces.filter(workspace => workspace.id !== id));
    } catch (err) {
      console.error('Error deleting workspace:', err);
      alert('Failed to delete workspace');
    }
  };

  // Handle sharing
  const handleShareWorkspace = (workspace) => {
    setSelectedWorkspace(workspace);
    setShowShareModal(true);
  };

  // Group workspaces
  const myWorkspaces = workspaces.filter(workspace => workspace.is_owner);
  const sharedWorkspaces = workspaces.filter(workspace => !workspace.is_owner);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Workspaces</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Create Workspace
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex px-6" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('my-workspaces')}
            className={`${
              activeTab === 'my-workspaces'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm mr-8`}
          >
            My Workspaces ({myWorkspaces.length})
          </button>
          <button
            onClick={() => setActiveTab('shared-workspaces')}
            className={`${
              activeTab === 'shared-workspaces'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Shared with Me ({sharedWorkspaces.length})
          </button>
        </nav>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative m-6" role="alert">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      )}

      {/* Workspace list content */}
      <div className="px-6 py-5">
        {activeTab === 'my-workspaces' && (
          <>
            {myWorkspaces.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <svg className="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No workspaces found</h3>
                <p className="mt-1 text-sm text-gray-500">Get started by creating a new workspace.</p>
                <div className="mt-6">
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Create Workspace
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white overflow-hidden rounded-md">
                <ul className="divide-y divide-gray-200">
                  {myWorkspaces.map((workspace) => (
                    <li key={workspace.id} className="px-6 py-4 flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center">
                            {workspace.name.charAt(0).toUpperCase()}
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-indigo-600">{workspace.name}</div>
                          <div className="text-sm text-gray-500">
                            Created: {new Date(workspace.created_at).toLocaleDateString()}
                            <span className="ml-2">
                              {workspace.rule_count || 0} rule{workspace.rule_count !== 1 ? 's' : ''}
                            </span>
                          </div>
                          {workspace.shares && workspace.shares.length > 0 && (
                            <div className="mt-1 text-xs text-gray-500">
                              Shared with: {workspace.shares.map(share => share.username).join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleShareWorkspace(workspace)}
                          className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          <svg className="mr-1 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                          </svg>
                          Share
                        </button>
                        <Link
                          to={`/workspaces/${workspace.id}`}
                          className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          Open
                        </Link>
                        <button
                          onClick={() => handleDeleteWorkspace(workspace.id)}
                          className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-red-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          <svg className="mr-1 h-4 w-4 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {activeTab === 'shared-workspaces' && (
          <>
            {sharedWorkspaces.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <svg className="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No shared workspaces</h3>
                <p className="mt-1 text-sm text-gray-500">Others can share their workspaces with you.</p>
              </div>
            ) : (
              <div className="bg-white overflow-hidden rounded-md">
                <ul className="divide-y divide-gray-200">
                  {sharedWorkspaces.map((workspace) => (
                    <li key={workspace.id} className="px-6 py-4 flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center">
                            {workspace.name.charAt(0).toUpperCase()}
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-green-600">{workspace.name}</div>
                          <div className="text-sm text-gray-500">
                            Owner: {workspace.owner_username}
                            <span className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              workspace.permission === 'write' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {workspace.permission === 'write' ? 'Read & Write' : 'Read Only'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <Link
                          to={`/workspaces/${workspace.id}`}
                          className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        >
                          Open
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <CreateWorkspaceModal
          onClose={() => setShowCreateModal(false)}
          onWorkspaceCreated={handleWorkspaceCreated}
        />
      )}

      {/* Share Workspace Modal */}
      {showShareModal && selectedWorkspace && (
        <ShareWorkspaceModal
          workspace={selectedWorkspace}
          onClose={() => {
            setShowShareModal(false);
            setSelectedWorkspace(null);
          }}
        />
      )}
    </div>
  );
};

export default WorkspaceList; 