import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

function History({ setWorkspace, currentWorkspace, restorePreviousWorkspace }) {
    const [workspaces, setWorkspaces] = useState([]);
    const [ruleGenerations, setRuleGenerations] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedWorkspace, setSelectedWorkspace] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        fetchWorkspaces();
    }, []);

    useEffect(() => {
        if (selectedWorkspace) {
            fetchRuleGenerationsForWorkspace(selectedWorkspace);
        } else {
            setRuleGenerations([]);
        }
    }, [selectedWorkspace]);

    const fetchWorkspaces = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await api.get('/api/rule-generations/workspaces/');
            setWorkspaces(response.data);

            // If current workspace exists, select it by default
            if (currentWorkspace) {
                const matching = response.data.find(w => w.workspace_name === currentWorkspace.name);
                if (matching) {
                    setSelectedWorkspace(matching.workspace_name);
                }
            }
        } catch (error) {
            console.error('Error fetching workspaces:', error);
        } finally {
            setIsLoading(false);
        }
    }, [currentWorkspace]);

    useEffect(() => {
        fetchWorkspaces();
    }, [fetchWorkspaces]);

    const fetchRuleGenerationsForWorkspace = async (workspaceName) => {
        try {
            setIsLoading(true);
            const response = await api.get('/api/rule-generations/');
            // Filter generations for the selected workspace
            const filtered = response.data.filter(
                generation => generation.workspace_name === workspaceName
            );
            setRuleGenerations(filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
        } catch (error) {
            console.error('Error fetching rule generations:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleWorkspaceSelect = (workspaceName) => {
        setSelectedWorkspace(workspaceName);
    };

    const loadRuleGeneration = (ruleGeneration) => {
        // Ask for confirmation if there's a current workspace
        if (currentWorkspace && currentWorkspace.name !== ruleGeneration.workspace_name) {
            if (!window.confirm(
                `You'll be switching from "${currentWorkspace.name}" to "${ruleGeneration.workspace_name}". Continue?`
            )) {
                return;
            }
        }

        // Set workspace
        setWorkspace({
            name: ruleGeneration.workspace_name,
            ruleGenerationId: ruleGeneration.id,
            created: ruleGeneration.created_at
        });

        // Navigate to rule generation
        navigate('/rulegen');
    };

    const createNewWorkspace = () => {
        // Ask for confirmation if there's a current workspace
        if (currentWorkspace) {
            if (!window.confirm('Creating a new workspace will close your current workspace. Continue?')) {
                return;
            }
        }

        navigate('/');
    };

    const returnToCurrent = () => {
        if (restorePreviousWorkspace()) {
            navigate('/rulegen');
        } else {
            navigate('/');
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Workspace History</h2>
                <div className="space-x-3">
                    {currentWorkspace && (
                        <button
                            onClick={returnToCurrent}
                            className="border border-indigo-600 text-indigo-600 px-3 py-1 rounded hover:bg-indigo-50 transition-colors"
                        >
                            Return to Current Workspace
                        </button>
                    )}
                    <button
                        onClick={createNewWorkspace}
                        className="bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 transition-colors"
                    >
                        Create New Workspace
                    </button>
                </div>
            </div>

            {isLoading && !selectedWorkspace ? (
                <div className="flex justify-center items-center p-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    <p className="ml-3">Loading workspaces...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Workspace list */}
                    <div className="md:col-span-1 border-r pr-6">
                        <h3 className="font-semibold mb-3">Workspaces</h3>
                        {workspaces.length === 0 ? (
                            <p className="text-gray-500">No workspaces found</p>
                        ) : (
                            <ul className="space-y-2">
                                {workspaces.map((workspace) => (
                                    <li key={workspace.workspace_name}>
                                        <button
                                            onClick={() => handleWorkspaceSelect(workspace.workspace_name)}
                                            className={`w-full text-left px-3 py-2 rounded-md transition-colors ${selectedWorkspace === workspace.workspace_name
                                                ? 'bg-indigo-100 text-indigo-700'
                                                : 'hover:bg-gray-100'
                                                }`}
                                        >
                                            <div className="font-medium">{workspace.workspace_name}</div>
                                            <div className="text-xs text-gray-500">
                                                {workspace.count} rule generation{workspace.count !== 1 ? 's' : ''}
                                            </div>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Rule generations list */}
                    <div className="md:col-span-3">
                        <h3 className="font-semibold mb-3">
                            {selectedWorkspace
                                ? `Rule Generations for "${selectedWorkspace}"`
                                : 'Select a workspace to view rule generations'}
                        </h3>

                        {isLoading && selectedWorkspace ? (
                            <div className="flex justify-center items-center p-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                <p className="ml-3">Loading rule generations...</p>
                            </div>
                        ) : !selectedWorkspace ? (
                            <p className="text-gray-500 py-3">Select a workspace from the list</p>
                        ) : ruleGenerations.length === 0 ? (
                            <p className="text-gray-500 py-3">No rule generations found for this workspace</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full bg-white">
                                    <thead>
                                        <tr className="bg-gray-100">
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                ID
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Date
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Files
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Status
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {ruleGenerations.map((generation) => (
                                            <tr key={generation.id}>
                                                <td className="px-6 py-4 whitespace-nowrap">{generation.id}</td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {new Date(generation.created_at).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {generation.email_files.length} files
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {generation.is_complete ? (
                                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                            Complete
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                                            Processing
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <button
                                                        onClick={() => loadRuleGeneration(generation)}
                                                        className="text-indigo-600 hover:text-indigo-900"
                                                    >
                                                        <i className="fas fa-eye mr-1"></i> View
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default History;
