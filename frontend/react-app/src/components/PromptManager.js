import { useState, useEffect } from 'react';
import api from '../api';
import PromptTemplateForm from './prompt-manager/PromptTemplateForm';
import PromptTemplateList from './prompt-manager/PromptTemplateList';

function PromptManager() {
    const [templates, setTemplates] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editingTemplate, setEditingTemplate] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [filterType, setFilterType] = useState('all');

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            setIsLoading(true);
            const response = await api.get('/api/prompt-templates/');
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
            setError('Failed to delete template. Please try again.');
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

    const filteredTemplates = templates.filter(template => {
        if (filterType === 'all') return true;
        if (filterType === 'base') return template.is_base;
        if (filterType === 'modules') return template.is_module;
        return true;
    });

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
                />
            ) : (
                <>
                    <div className="mb-4">
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

                    <PromptTemplateList
                        templates={filteredTemplates}
                        isLoading={isLoading}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                    />
                </>
            )}
        </div>
    );
}

export default PromptManager;
