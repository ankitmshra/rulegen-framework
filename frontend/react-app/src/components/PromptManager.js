import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import PromptTemplateForm from './prompt-manager/PromptTemplateForm';
import PromptTemplateList from './prompt-manager/PromptTemplateList';

function PromptManager() {
    const [templates, setTemplates] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [filterType, setFilterType] = useState('all');
    const [filterVisibility, setFilterVisibility] = useState('all');
    const { isAdmin, isPowerUser } = useAuth();

    useEffect(() => {
        fetchTemplates();
    }, [filterVisibility]);

    const fetchTemplates = async () => {
        try {
            setIsLoading(true);
            
            // Build query params based on filters
            let url = '/api/prompt-templates/';
            const params = [];
            
            if (filterType === 'base') {
                params.push('is_base=true');
            } else if (filterType === 'modules') {
                params.push('is_module=true');
            }
            
            // Add params to URL if any exist
            if (params.length > 0) {
                url += '?' + params.join('&');
            }
            
            const response = await api.get(url);
            setTemplates(response.data);
            setError(null);
        } catch (err) {
            console.error('Error fetching prompt templates:', err);
            setError('Failed to load prompt templates. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateNew = () => {
        setEditingTemplate(null);
        setShowForm(true);
    };

    const handleEdit = (template) => {
        setEditingTemplate(template);
        setShowForm(true);
    };

    const handleDelete = async (templateId) => {
        if (!window.confirm('Are you sure you want to delete this template?')) {
            return;
        }

        try {
            await api.delete(`/api/prompt-templates/${templateId}/`);
            fetchTemplates();
        } catch (err) {
            console.error('Error deleting template:', err);
            if (err.response?.status === 403) {
                setError('You do not have permission to delete this template.');
            } else {
                setError('Failed to delete template. Please try again.');
            }
        }
    };

    const handleSave = async (templateData) => {
        try {
            if (editingTemplate) {
                // Update existing template
                await api.put(`/api/prompt-templates/${editingTemplate.id}/`, templateData);
            } else {
                // Create new template
                await api.post('/api/prompt-templates/', templateData);
            }

            setShowForm(false);
            fetchTemplates();
        } catch (err) {
            console.error('Error saving template:', err);
            if (err.response?.status === 403) {
                return {
                    success: false,
                    error: 'You do not have permission to perform this action.'
                };
            }
            return {
                success: false,
                error: err.response?.data || 'Failed to save template. Please try again.'
            };
        }

        return { success: true };
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingTemplate(null);
    };

    // Filter templates based on type and visibility
    const getFilteredTemplates = () => {
        let filtered = [...templates];
        
        // Filter by type
        if (filterType === 'base') {
            filtered = filtered.filter(template => template.is_base);
        } else if (filterType === 'modules') {
            filtered = filtered.filter(template => template.is_module);
        }
        
        // Filter by visibility
        if (filterVisibility !== 'all') {
            filtered = filtered.filter(template => template.visibility === filterVisibility);
        }
        
        return filtered;
    };

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Prompt Template Manager</h2>
                {!showForm && (
                    <button
                        onClick={handleCreateNew}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
                    >
                        <i className="fas fa-plus mr-2"></i> Create New Template
                    </button>
                )}
            </div>

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    {error}
                </div>
            )}

            {showForm ? (
                <PromptTemplateForm
                    template={editingTemplate}
                    onSave={handleSave}
                    onCancel={handleCancel}
                    isAdmin={isAdmin()}
                    isPowerUser={isPowerUser()}
                />
            ) : (
                <>
                    <div className="flex flex-wrap gap-4 mb-4">
                        {/* Template type filter */}
                        <div>
                            <div className="inline-flex rounded-md shadow-sm" role="group">
                                <button
                                    onClick={() => setFilterType('all')}
                                    className={`px-4 py-2 text-sm font-medium rounded-l-md ${filterType === 'all'
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                                        }`}
                                >
                                    All Templates
                                </button>
                                <button
                                    onClick={() => setFilterType('base')}
                                    className={`px-4 py-2 text-sm font-medium ${filterType === 'base'
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-white text-gray-700 border-t border-b border-gray-300 hover:bg-gray-50'
                                        }`}
                                >
                                    Base Prompts
                                </button>
                                <button
                                    onClick={() => setFilterType('modules')}
                                    className={`px-4 py-2 text-sm font-medium rounded-r-md ${filterType === 'modules'
                                            ? 'bg-indigo-600 text-white'
                                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                                        }`}
                                >
                                    Modules
                                </button>
                            </div>
                        </div>
                        
                        {/* Visibility filter - only show for admins and power users */}
                        {isPowerUser() && (
                            <div>
                                <div className="inline-flex rounded-md shadow-sm" role="group">
                                    <button
                                        onClick={() => setFilterVisibility('all')}
                                        className={`px-4 py-2 text-sm font-medium rounded-l-md ${filterVisibility === 'all'
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        All Visibility
                                    </button>
                                    <button
                                        onClick={() => setFilterVisibility('global')}
                                        className={`px-4 py-2 text-sm font-medium ${filterVisibility === 'global'
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-white text-gray-700 border-t border-b border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        Global
                                    </button>
                                    <button
                                        onClick={() => setFilterVisibility('user_workspaces')}
                                        className={`px-4 py-2 text-sm font-medium ${filterVisibility === 'user_workspaces'
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-white text-gray-700 border-t border-b border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        User Workspaces
                                    </button>
                                    <button
                                        onClick={() => setFilterVisibility('current_workspace')}
                                        className={`px-4 py-2 text-sm font-medium rounded-r-md ${filterVisibility === 'current_workspace'
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        Workspace
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <PromptTemplateList
                        templates={getFilteredTemplates()}
                        isLoading={isLoading}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        isAdmin={isAdmin()}
                        isPowerUser={isPowerUser()}
                    />
                </>
            )}
        </div>
    );
}

export default PromptManager;
