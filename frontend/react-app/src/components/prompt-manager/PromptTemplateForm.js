import { useState, useEffect } from 'react';

function PromptTemplateForm({ template, onSave, onCancel }) {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        template: '',
        is_base: false,
        is_module: false,
        module_type: '',
    });
    const [errors, setErrors] = useState({});
    const [isSaving, setIsSaving] = useState(false);

    // Initialize form with template data if editing
    useEffect(() => {
        if (template) {
            setFormData({
                name: template.name || '',
                description: template.description || '',
                template: template.template || '',
                is_base: template.is_base || false,
                is_module: template.is_module || false,
                module_type: template.module_type || '',
            });
        }
    }, [template]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));

        // Clear any error for this field
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: null
            }));
        }
    };

    const validate = () => {
        const newErrors = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Name is required';
        }

        if (!formData.template.trim()) {
            newErrors.template = 'Template content is required';
        }

        if (formData.is_module && !formData.module_type.trim()) {
            newErrors.module_type = 'Module type is required for module templates';
        }

        // Add validation to ensure only one base prompt exists
        if (formData.is_base && template?.is_base === false) {
            // This would be checked against the API in a real implementation
            // Here we're just adding it to demonstrate validation logic
            // newErrors.is_base = 'Only one base prompt can exist';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validate()) {
            return;
        }

        setIsSaving(true);

        const result = await onSave(formData);

        if (!result.success) {
            // Handle API validation errors
            if (result.error && typeof result.error === 'object') {
                setErrors(result.error);
            } else {
                setErrors({ general: result.error || 'Failed to save template. Please try again.' });
            }
        }

        setIsSaving(false);
    };

    return (
        <div className="bg-white rounded-lg border p-6">
            <h3 className="text-xl font-semibold mb-4">
                {template ? 'Edit Prompt Template' : 'Create New Prompt Template'}
            </h3>

            {errors.general && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    {errors.general}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                        <label className="block text-gray-700 font-medium mb-2" htmlFor="name">
                            Template Name*
                        </label>
                        <input
                            id="name"
                            name="name"
                            type="text"
                            className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400 ${errors.name ? 'border-red-500' : 'border-gray-300'
                                }`}
                            value={formData.name}
                            onChange={handleChange}
                        />
                        {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                    </div>

                    <div>
                        <label className="block text-gray-700 font-medium mb-2" htmlFor="description">
                            Description
                        </label>
                        <input
                            id="description"
                            name="description"
                            type="text"
                            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            value={formData.description}
                            onChange={handleChange}
                        />
                    </div>
                </div>

                <div className="mb-6">
                    <label className="block text-gray-700 font-medium mb-2" htmlFor="template">
                        Template Content*
                    </label>
                    <textarea
                        id="template"
                        name="template"
                        rows="10"
                        className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400 font-mono ${errors.template ? 'border-red-500' : 'border-gray-300'
                            }`}
                        value={formData.template}
                        onChange={handleChange}
                    ></textarea>
                    {errors.template && <p className="text-red-500 text-sm mt-1">{errors.template}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div>
                        <div className="flex items-center">
                            <input
                                id="is_base"
                                name="is_base"
                                type="checkbox"
                                className="rounded text-indigo-600 focus:ring-indigo-500 mr-2"
                                checked={formData.is_base}
                                onChange={handleChange}
                            />
                            <label className="text-gray-700 font-medium" htmlFor="is_base">
                                Is Base Prompt
                            </label>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                            Only one base prompt can exist in the system.
                        </p>
                        {errors.is_base && <p className="text-red-500 text-sm mt-1">{errors.is_base}</p>}
                    </div>

                    <div>
                        <div className="flex items-center">
                            <input
                                id="is_module"
                                name="is_module"
                                type="checkbox"
                                className="rounded text-indigo-600 focus:ring-indigo-500 mr-2"
                                checked={formData.is_module}
                                onChange={handleChange}
                            />
                            <label className="text-gray-700 font-medium" htmlFor="is_module">
                                Is Module
                            </label>
                        </div>
                    </div>

                    {formData.is_module && (
                        <div>
                            <label className="block text-gray-700 font-medium mb-2" htmlFor="module_type">
                                Module Type*
                            </label>
                            <input
                                id="module_type"
                                name="module_type"
                                type="text"
                                className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400 ${errors.module_type ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                value={formData.module_type}
                                onChange={handleChange}
                            />
                            {errors.module_type && <p className="text-red-500 text-sm mt-1">{errors.module_type}</p>}
                            <p className="text-sm text-gray-500 mt-1">
                                Examples: scoring, subrules, notes, uri
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex justify-end space-x-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                        disabled={isSaving}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center"
                        disabled={isSaving}
                    >
                        {isSaving && <span className="animate-spin mr-2">⏳</span>}
                        {isSaving ? 'Saving...' : 'Save Template'}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default PromptTemplateForm;
