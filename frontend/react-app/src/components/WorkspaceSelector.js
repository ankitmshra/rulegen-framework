import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import ShareWorkspaceModal from './ShareWorkspaceModal';

function WorkspaceSelector({ setCurrentWorkspace }) {
    const [workspaceName, setWorkspaceName] = useState('');
    const [error, setError] = useState('');
    const [recentWorkspaces, setRecentWorkspaces] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [showAllWorkspaces, setShowAllWorkspaces] = useState(false);
    
    // New state for sharing functionality
    const [sharedWorkspaces, setSharedWorkspaces] = useState([]);
    const [selectedWorkspace, setSelectedWorkspace] = useState(null);
    const [showShareModal, setShowShareModal] = useState(false);
    const [isLoadingShared, setIsLoadingShared] = useState(false);
    
    const navigate = useNavigate();
    const { user, isAdmin } = useAuth();

    useEffect(() => {
        // Load recent workspaces
        fetchWorkspaces();
        // Load shared workspaces
        fetchSharedWorkspaces();
    }, [showAllWorkspaces]);

    const fetchWorkspaces = async () => {
        try {
            setIsLoading(true);
            // Include 'all' parameter for admins who want to see all workspaces
            const url = isAdmin() && showAllWorkspaces 
                ? '/api/rule-generations/workspaces/?all=true'
                : '/api/rule-generations/workspaces/';
                
            const response = await api.get(url);
            
            // If showing all workspaces, get more results
            const limit = isAdmin() && showAllWorkspaces ? 20 : 5;
            setRecentWorkspaces(response.data.slice(0, limit));
        } catch (error) {
            console.error('Error fetching workspaces:', error);
        } finally {
            setIsLoading(false);
        }
    };
    
    const fetchSharedWorkspaces = async () => {
        try {
            setIsLoadingShared(true);
            const response = await api.get('/api/rule-generations/shared_workspaces/');
            setSharedWorkspaces(response.data);
        } catch (error) {
            console.error('Error fetching shared workspaces:', error);
        } finally {
            setIsLoadingShared(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!workspaceName.trim()) {
            setError('Please enter a workspace name');
            return;
        }
        
        // Enforce 25 character limit
        if (workspaceName.length > 25) {
            setError('Workspace name cannot exceed 25 characters');
            return;
        }

        try {
            setIsCreating(true);
            
            // Create a new rule generation with this workspace name
            const response = await api.post('/api/rule-generations/', {
                workspace_name: workspaceName,
                email_file_ids: [],  // Empty array initially
                selected_headers: [],  // Empty array initially
                prompt_modules: []    // Empty array initially
            });
            
            // Then update the current workspace
            const newWorkspace = {
                name: workspaceName,
                ruleGenerationId: response.data.id,
                created: response.data.created_at || new Date().toISOString(),
                isNew: true  // Flag to indicate this is a brand new workspace
            };
            
            setCurrentWorkspace(newWorkspace);
            
            // Navigate to rulegen with the workspace
            navigate('/rulegen', { 
                replace: true, 
                state: { 
                    newWorkspace: newWorkspace,
                    isNewWorkspace: true
                } 
            });
        } catch (error) {
            console.error('Error creating workspace:', error);
            if (error.response?.data?.workspace_name) {
                setError(error.response.data.workspace_name[0]);
            } else {
                setError('Failed to create workspace. Please try again.');
            }
        } finally {
            setIsCreating(false);
        }
    };
    
    const handleShareWorkspace = (workspace) => {
        setSelectedWorkspace(workspace);
        setShowShareModal(true);
    };
    
    const handleSharedSuccess = () => {
        // Refresh the workspaces list to show updated shares
        fetchWorkspaces();
    };
    
    const selectRecentWorkspace = (workspace) => {
        const selectedWorkspace = {
            name: workspace.workspace_name,
            ruleGenerationId: workspace.latest_id,
            created: workspace.latest_date,
            isNew: false
        };
        
        setCurrentWorkspace(selectedWorkspace);

        // Navigate to rulegen with the selected workspace
        navigate('/rulegen', { 
            replace: true, 
            state: { 
                newWorkspace: selectedWorkspace,
                isNewWorkspace: false
            } 
        });
    };
    
    const selectSharedWorkspace = (workspace) => {
        const selectedWorkspace = {
            name: workspace.workspace_name,
            ruleGenerationId: workspace.latest_id,
            created: workspace.latest_date,
            owner: {
                id: workspace.owner_id,
                username: workspace.owner_username
            },
            permission: workspace.permission,
            isShared: true
        };
        
        setCurrentWorkspace(selectedWorkspace);

        // Navigate to rulegen with the selected workspace
        navigate('/rulegen', { 
            replace: true, 
            state: { 
                newWorkspace: selectedWorkspace,
                isNewWorkspace: false
            } 
        });
    };

    const toggleShowAllWorkspaces = () => {
        setShowAllWorkspaces(!showAllWorkspaces);
    };
    
    const handleRemoveShare = async (workspaceName, userId) => {
        if (!window.confirm('Are you sure you want to remove this user\'s access?')) {
            return;
        }
        
        try {
            await api.delete('/api/rule-generations/unshare_workspace/', {
                data: {
                    workspace_name: workspaceName,
                    user_id: userId
                }
            });
            
            // Refresh the workspaces list
            fetchWorkspaces();
        } catch (error) {
            console.error('Error removing share:', error);
            alert('Failed to remove sharing. Please try again.');
        }
    };

    return (
        <div className="max-w-xl mx-auto">
            <div className="bg-white p-8 rounded-lg shadow-md mb-6">
                <h2 className="text-2xl font-bold mb-6 text-center">New SpamAssassin Investigation</h2>

                <form onSubmit={handleSubmit}>
                    <div className="mb-6">
                        <label
                            className="block text-gray-700 font-medium mb-2"
                            htmlFor="workspace-name"
                        >
                            Workspace Name <span className="text-sm text-gray-500">(max 25 characters)</span>
                        </label>
                        <input
                            id="workspace-name"
                            type="text"
                            className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400 ${error ? 'border-red-500' : 'border-gray-300'
                                }`}
                            value={workspaceName}
                            onChange={(e) => {
                                setWorkspaceName(e.target.value);
                                if (error) setError('');
                            }}
                            maxLength={25}
                            placeholder="Enter a name for this investigation"
                        />
                        {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
                        <div className="text-right text-sm text-gray-500 mt-1">
                            {workspaceName.length}/25 characters
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition duration-200"
                        disabled={isCreating}
                    >
                        {isCreating ? (
                            <span className="flex items-center justify-center">
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Creating...
                            </span>
                        ) : 'Create Workspace'}
                    </button>
                </form>
            </div>

            {/* Recent workspaces */}
            <div className="bg-white p-8 rounded-lg shadow-md mb-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold">
                        {isAdmin() && showAllWorkspaces ? 'All Workspaces' : 'My Workspaces'}
                    </h3>
                    
                    {/* Toggle for admins to show all workspaces */}
                    {isAdmin() && (
                        <button
                            onClick={toggleShowAllWorkspaces}
                            className="text-indigo-600 hover:text-indigo-800 text-sm"
                        >
                            {showAllWorkspaces ? 'Show My Recent' : 'Show All'}
                        </button>
                    )}
                </div>

                {isLoading ? (
                    <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                        <p className="mt-2 text-gray-600">Loading workspaces...</p>
                    </div>
                ) : recentWorkspaces.length === 0 ? (
                    <p className="text-gray-500 py-2">No workspaces found</p>
                ) : (
                    <ul className="divide-y">
                        {recentWorkspaces.map((workspace) => (
                            <li key={workspace.latest_id} className="py-3">
                                <div className="flex justify-between items-center">
                                    <button
                                        onClick={() => selectRecentWorkspace(workspace)}
                                        className="flex items-center flex-grow text-left px-3 py-2 hover:bg-gray-50 rounded-md transition-colors"
                                    >
                                        <div className="flex-grow">
                                            <div className="font-medium">{workspace.workspace_name}</div>
                                            <div className="text-sm text-gray-500">
                                                Created: {new Date(workspace.latest_date).toLocaleString()}
                                                {/* Show username for admins viewing all workspaces */}
                                                {isAdmin() && showAllWorkspaces && workspace.user__username && (
                                                    <span className="ml-2">by {workspace.user__username}</span>
                                                )}
                                            </div>
                                            {/* Show share count if any */}
                                            {workspace.shares && workspace.shares.length > 0 && (
                                                <div className="mt-1 text-xs text-indigo-600">
                                                    Shared with {workspace.shares.length} user{workspace.shares.length > 1 ? 's' : ''}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-indigo-600">
                                            <i className="fas fa-chevron-right"></i>
                                        </div>
                                    </button>
                                    
                                    <button
                                        onClick={() => handleShareWorkspace(workspace)}
                                        className="ml-2 text-indigo-600 hover:text-indigo-800 p-2"
                                        title="Share workspace"
                                    >
                                        <i className="fas fa-share-alt"></i>
                                    </button>
                                </div>
                                
                                {/* Show existing shares */}
                                {workspace.shares && workspace.shares.length > 0 && (
                                    <div className="mt-2 pl-4 pr-2">
                                        <div className="text-xs text-gray-500 mb-1">Shared with:</div>
                                        <ul className="space-y-1">
                                            {workspace.shares.map(share => (
                                                <li key={share.user_id} className="flex justify-between items-center text-sm bg-gray-50 p-2 rounded">
                                                    <div>
                                                        <span className="font-medium">{share.username}</span>
                                                        <span className="text-gray-500 ml-2">({share.email})</span>
                                                        <span className="ml-2 px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800">
                                                            {share.permission === 'write' ? 'Read & Write' : 'Read Only'}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleRemoveShare(workspace.workspace_name, share.user_id)}
                                                        className="text-red-500 hover:text-red-700"
                                                        title="Remove access"
                                                    >
                                                        <i className="fas fa-times"></i>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            
            {/* Shared with me section */}
            <div className="bg-white p-8 rounded-lg shadow-md">
                <h3 className="text-xl font-semibold mb-4">Shared with Me</h3>
                
                {isLoadingShared ? (
                    <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                        <p className="mt-2 text-gray-600">Loading shared workspaces...</p>
                    </div>
                ) : sharedWorkspaces.length === 0 ? (
                    <p className="text-gray-500 py-2">No workspaces have been shared with you</p>
                ) : (
                    <ul className="divide-y">
                        {sharedWorkspaces.map((workspace) => (
                            <li key={`${workspace.owner_id}-${workspace.workspace_name}`} className="py-3">
                                <button
                                    onClick={() => selectSharedWorkspace(workspace)}
                                    className="flex items-center w-full text-left px-3 py-2 hover:bg-gray-50 rounded-md transition-colors"
                                >
                                    <div className="flex-grow">
                                        <div className="flex items-center">
                                            <span className="font-medium">{workspace.workspace_name}</span>
                                            <span className="ml-2 px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800">
                                                {workspace.permission === 'write' ? 'Read & Write' : 'Read Only'}
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            Shared by: {workspace.owner_username}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            Last updated: {new Date(workspace.latest_date).toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="text-indigo-600">
                                        <i className="fas fa-chevron-right"></i>
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            
            {/* Share modal */}
            {showShareModal && selectedWorkspace && (
                <ShareWorkspaceModal 
                    workspace={selectedWorkspace}
                    onClose={() => setShowShareModal(false)}
                    onShared={handleSharedSuccess}
                />
            )}
        </div>
    );
}

export default WorkspaceSelector;
