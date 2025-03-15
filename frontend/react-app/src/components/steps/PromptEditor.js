import { useState } from 'react';

function PromptEditor({ prompt, customPrompt, setCustomPrompt, isLoading, onResetPrompt, disabled = false }) {
    const [isEditorOpen, setIsEditorOpen] = useState(false);

    const toggleEditor = () => {
        if (disabled) return;
        setIsEditorOpen(!isEditorOpen);
    };

    const handlePromptChange = (e) => {
        if (disabled) return;
        setCustomPrompt(e.target.value);
    };

    return (
        <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold">Prompt Template:</h3>
                <button
                    onClick={toggleEditor}
                    className={`text-indigo-600 hover:text-indigo-800 flex items-center text-sm ${
                        disabled ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    disabled={disabled}
                >
                    <i className={`fas ${isEditorOpen ? 'fa-eye' : 'fa-edit'} mr-1`}></i>
                    {isEditorOpen ? 'View Preview' : 'Edit Prompt'}
                </button>
            </div>

            {isLoading ? (
                <div className="bg-gray-50 p-4 rounded-lg h-48 flex justify-center items-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mr-3"></div>
                    <p>Loading prompt template...</p>
                </div>
            ) : isEditorOpen ? (
                <div>
                    <textarea
                        className={`w-full h-64 p-4 border rounded-lg font-mono text-sm resize-y ${
                            disabled ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        value={customPrompt}
                        onChange={handlePromptChange}
                        placeholder="Loading prompt..."
                        disabled={disabled}
                    ></textarea>
                    <div className="flex justify-end mt-2 space-x-2">
                        <button
                            onClick={onResetPrompt}
                            className={`text-indigo-600 px-3 py-1 rounded border border-indigo-600 hover:bg-indigo-50 transition-colors ${
                                disabled ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            disabled={disabled}
                        >
                            <i className="fas fa-undo mr-1"></i> Reset to Default
                        </button>
                        <button
                            onClick={toggleEditor}
                            className={`bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 transition-colors ${
                                disabled ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                            disabled={disabled}
                        >
                            <i className="fas fa-check mr-1"></i> Save Changes
                        </button>
                    </div>
                </div>
            ) : (
                <div className="bg-gray-50 p-4 rounded-lg">
                    <pre className="whitespace-pre-wrap font-mono text-sm max-h-48 overflow-y-auto">
                        {customPrompt || 'No prompt template available'}
                    </pre>
                </div>
            )}
        </div>
    );
}

export default PromptEditor;
