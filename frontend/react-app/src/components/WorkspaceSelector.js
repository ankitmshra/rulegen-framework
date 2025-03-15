import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

function WorkspaceSelector({ setCurrentWorkspace }) {
    const [workspaceName, setWorkspaceName] = useState('');
    const [error, setError] = useState('');
    const [recentWorkspaces, setRecentWorkspaces] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const navigate = useNavigate();
    const { user } = useAuth();

    useEffect(() => {
        // Load recent workspaces
        fetchWorkspaces();
    }, []);

    const fetchWorkspaces = async () => {
        try {
            setIsLoading(true);
            const response = await api.get('/api/rule-generations/workspaces/');
            setRecentWorkspaces(response.data.slice(0, 5)); // Get top 5 recent workspaces
        } catch (error) {
            console.error('Error fetching workspaces:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!workspaceName.trim()) {
            setError('Please enter a workspace name');
            return;
        }

        try {
            setIsCreating(true);
            
            // Create a new rule generation with this workspace name
            // This registers the workspace in the database immediately
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
            setError('Failed to create workspace. Please try again.');
        } finally {
            setIsCreating(false);
        }
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
                            Workspace Name
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
                            placeholder="Enter a name for this investigation"
                        />
                        {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
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
            <div className="bg-white p-8 rounded-lg shadow-md">
                <h3 className="text-xl font-semibold mb-4">Recent Workspaces</h3>

                {isLoading ? (
                    <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                        <p className="mt-2 text-gray-600">Loading workspaces...</p>
                    </div>
                ) : recentWorkspaces.length === 0 ? (
                    <p className="text-gray-500 py-2">No recent workspaces found</p>
                ) : (
                    <ul className="divide-y">
                        {recentWorkspaces.map((workspace) => (
                            <li key={workspace.latest_id} className="py-3">
                                <button
                                    onClick={() => selectRecentWorkspace(workspace)}
                                    className="flex items-center w-full text-left px-3 py-2 hover:bg-gray-50 rounded-md transition-colors"
                                >
                                    <div className="flex-grow">
                                        <div className="font-medium">{workspace.workspace_name}</div>
                                        <div className="text-sm text-gray-500">
                                            Created: {new Date(workspace.latest_date).toLocaleString()}
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
        </div>
    );
}

export default WorkspaceSelector;
