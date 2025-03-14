import React from 'react';

function PromptTemplateList({ templates, isLoading, onEdit, onDelete }) {
    if (isLoading) {
        return (
            <div className="flex justify-center items-center p-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                <p className="ml-3">Loading templates...</p>
            </div>
        );
    }

    if (templates.length === 0) {
        return (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
                <p className="text-gray-500">No templates found.</p>
            </div>
        );
    }

    // Group templates by type for better organization
    const baseTemplates = templates.filter(t => t.is_base);
    const moduleTemplates = templates.filter(t => t.is_module);
    const otherTemplates = templates.filter(t => !t.is_base && !t.is_module);

    return (
        <div className="space-y-6">
            {baseTemplates.length > 0 && (
                <TemplateSection
                    title="Base Prompts"
                    templates={baseTemplates}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            )}

            {moduleTemplates.length > 0 && (
                <TemplateSection
                    title="Module Prompts"
                    templates={moduleTemplates}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            )}

            {otherTemplates.length > 0 && (
                <TemplateSection
                    title="Other Templates"
                    templates={otherTemplates}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            )}
        </div>
    );
}

function TemplateSection({ title, templates, onEdit, onDelete }) {
    return (
        <div>
            <h3 className="text-lg font-semibold mb-3">{title}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map(template => (
                    <TemplateCard
                        key={template.id}
                        template={template}
                        onEdit={onEdit}
                        onDelete={onDelete}
                    />
                ))}
            </div>
        </div>
    );
}

function TemplateCard({ template, onEdit, onDelete }) {
    return (
        <div className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
            <div className="bg-gray-50 p-4 border-b">
                <div className="flex justify-between items-start">
                    <div>
                        <h4 className="font-semibold text-lg">{template.name}</h4>
                        <div className="flex space-x-2 mt-1">
                            {template.is_base && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-xs">
                                    Base Prompt
                                </span>
                            )}
                            {template.is_module && (
                                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-md text-xs">
                                    Module: {template.module_type}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex space-x-2">
                        <button
                            onClick={() => onEdit(template)}
                            className="text-indigo-600 hover:text-indigo-800"
                            title="Edit"
                        >
                            <i className="fas fa-edit"></i>
                        </button>
                        <button
                            onClick={() => onDelete(template.id)}
                            className="text-red-600 hover:text-red-800"
                            title="Delete"
                        >
                            <i className="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
            </div>
            <div className="p-4">
                <p className="text-gray-600 text-sm mb-2">{template.description}</p>
                <div className="mt-2 max-h-32 overflow-y-auto">
                    <pre className="text-xs bg-gray-100 p-2 rounded whitespace-pre-wrap break-words">
                        {template.template.length > 200
                            ? template.template.substring(0, 200) + '...'
                            : template.template}
                    </pre>
                </div>
                <div className="mt-3 text-xs text-gray-500">
                    Last updated: {new Date(template.updated_at).toLocaleString()}
                </div>
            </div>
        </div>
    );
}

export default PromptTemplateList;