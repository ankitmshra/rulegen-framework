import { useState, useEffect, useCallback } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';
import api from '../../api';
import PromptEditor from './PromptEditor';
import ModuleSelector from './ModuleSelector';

// Initialize marked with highlight.js for syntax highlighting
marked.setOptions({
    highlight: function (code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
    },
    langPrefix: 'hljs language-',
});

function RuleGenerate({
    workspace,
    emailFiles,
    selectedHeaders,
    selectedModules,
    setSelectedModules,
    ruleGeneration,
    setRuleGeneration,
    goToPreviousStep,
    isReadOnly = false
}) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPolling, setIsPolling] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [customPrompt, setCustomPrompt] = useState('');
    const [promptLoading, setPromptLoading] = useState(false);
    const [basePrompts, setBasePrompts] = useState([]);
    const [selectedBasePrompt, setSelectedBasePrompt] = useState(null);
    const [promptMetadata, setPromptMetadata] = useState(null);

    // Response history state
    const [responseHistory, setResponseHistory] = useState([]);
    const [currentHistoryIndex, setCurrentHistoryIndex] = useState(0);

    // Load available base prompts when component mounts
    useEffect(() => {
        fetchBasePrompts();
    }, []);

    // Load the default prompt when component mounts or when dependencies change
    useEffect(() => {
        if (!ruleGeneration?.rule && emailFiles.length > 0 && selectedHeaders.length > 0) {
            loadDefaultPrompt();
        }
    }, [emailFiles, selectedHeaders, selectedModules, selectedBasePrompt, ruleGeneration]);

    // If there's an existing rule, display it and add to history if not already there
    useEffect(() => {
        if (ruleGeneration?.rule) {
            if (ruleGeneration.prompt) {
                setPrompt(ruleGeneration.prompt);
                setCustomPrompt(ruleGeneration.prompt);
            }

            if (ruleGeneration.prompt_metadata) {
                setPromptMetadata(ruleGeneration.prompt_metadata);

                // If base prompt is in metadata, select it in the dropdown
                if (ruleGeneration.prompt_metadata.base_prompt && ruleGeneration.prompt_metadata.base_prompt.id) {
                    setSelectedBasePrompt(ruleGeneration.prompt_metadata.base_prompt.id.toString());
                }
            }

            // Check if this rule is already in the history
            const ruleExists = responseHistory.some(item => item.id === ruleGeneration.id);

            if (!ruleExists) {
                // Add this rule to history as the most recent
                setResponseHistory(prev => [
                    {
                        id: ruleGeneration.id,
                        rule: ruleGeneration.rule,
                        date: ruleGeneration.created_at || new Date().toISOString(),
                        title: `Response ${prev.length + 1}`
                    },
                    ...prev
                ]);
                setCurrentHistoryIndex(0);
            }
        }
    }, [ruleGeneration]);

    // Load history from localStorage on component mount
    useEffect(() => {
        const savedHistory = localStorage.getItem(`ruleHistory-${workspace.name}`);
        if (savedHistory) {
            try {
                const history = JSON.parse(savedHistory);
                setResponseHistory(history);
                setCurrentHistoryIndex(0); // Start with the most recent
            } catch (e) {
                console.error('Error parsing saved history:', e);
            }
        }
    }, [workspace.name]);

    // Save history to localStorage when it changes
    useEffect(() => {
        if (responseHistory.length > 0) {
            localStorage.setItem(`ruleHistory-${workspace.name}`, JSON.stringify(responseHistory));
        }
    }, [responseHistory, workspace.name]);

    const fetchBasePrompts = async () => {
        try {
            const response = await api.get('/api/rule-generations/base_prompts/');
            setBasePrompts(response.data);

            // If there is only one base prompt, select it automatically
            if (response.data.length === 1) {
                setSelectedBasePrompt(response.data[0].id.toString());
            }
        } catch (error) {
            console.error('Error fetching base prompts:', error);
        }
    };

    const loadDefaultPrompt = useCallback(async () => {
        try {
            setPromptLoading(true);
            const response = await api.post('/api/rule-generations/generate_default_prompt/', {
                email_file_ids: emailFiles.map(file => file.id),
                selected_headers: selectedHeaders,
                prompt_modules: selectedModules,
                base_prompt_id: selectedBasePrompt ? parseInt(selectedBasePrompt) : null,
                workspace_name: workspace.name
            });

            if (response.data.prompt) {
                setPrompt(response.data.prompt);
                setCustomPrompt(response.data.prompt);
            }

            if (response.data.metadata) {
                setPromptMetadata(response.data.metadata);
            }
        } catch (error) {
            console.error('Error loading default prompt:', error);
        } finally {
            setPromptLoading(false);
        }
    }, [emailFiles, selectedHeaders, selectedModules, selectedBasePrompt, workspace.name]);

    const generateRules = async () => {
        try {
            setIsGenerating(true);

            const requestData = {
                workspace_name: workspace.name,
                email_file_ids: emailFiles.map(file => file.id),
                selected_headers: selectedHeaders,
                prompt_modules: selectedModules,
                base_prompt_id: selectedBasePrompt ? parseInt(selectedBasePrompt) : null
            };

            // If custom prompt is different from the generated one, use it
            if (customPrompt !== prompt) {
                requestData.custom_prompt = customPrompt;
            }

            const response = await api.post('/api/rule-generations/', requestData);
            setRuleGeneration(response.data);

            // Start polling for completion
            startPolling(response.data.id);
        } catch (error) {
            console.error('Error generating rules:', error);
            alert('Failed to generate rules. Please try again.');
            setIsGenerating(false);
        }
    };

    const startPolling = (ruleGenerationId) => {
        setIsPolling(true);
        const intervalId = setInterval(async () => {
            try {
                const response = await api.get(`/api/rule-generations/${ruleGenerationId}/status/`);

                if (response.data.is_complete) {
                    clearInterval(intervalId);
                    setIsGenerating(false);
                    setIsPolling(false);

                    // Also update the full rule generation data
                    const fullResponse = await api.get(`/api/rule-generations/${ruleGenerationId}/`);
                    setRuleGeneration(fullResponse.data);
                }
            } catch (error) {
                console.error('Error polling rule generation status:', error);
                clearInterval(intervalId);
                setIsGenerating(false);
                setIsPolling(false);
                alert('Failed to check rule generation status. Please try again.');
            }
        }, 2000);
    };

    const copyToClipboard = () => {
        const currentResponse = responseHistory[currentHistoryIndex];
        if (currentResponse) {
            navigator.clipboard.writeText(currentResponse.rule)
                .then(() => {
                    alert('Rule copied to clipboard');
                })
                .catch(err => {
                    console.error('Failed to copy rule:', err);
                    alert('Failed to copy rule');
                });
        }
    };

    // Render the markdown rule as HTML
    const renderMarkdown = () => {
        const currentResponse = responseHistory[currentHistoryIndex];
        if (!currentResponse) return '';
        return marked(currentResponse.rule);
    };

    // Navigation handlers for history
    const goToHistoryItem = (index) => {
        setCurrentHistoryIndex(Math.max(0, Math.min(index, responseHistory.length - 1)));
    };

    const renderHistoryPagination = () => {
        if (responseHistory.length <= 1) return null;

        // Format datetime for display
        const formatDate = (dateString) => {
            try {
                const date = new Date(dateString);
                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } catch (e) {
                return "Unknown time";
            }
        };

        return (
            <div className="flex justify-center mt-4">
                <nav className="inline-flex rounded-md shadow-sm" aria-label="Response History">
                    <button
                        onClick={() => goToHistoryItem(currentHistoryIndex + 1)}
                        disabled={currentHistoryIndex >= responseHistory.length - 1}
                        className="px-3 py-1 rounded-l-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        title="Previous response"
                    >
                        <span className="sr-only">Previous</span>
                        <i className="fas fa-chevron-left"></i>
                    </button>

                    <div className="px-3 py-1 border-t border-b border-gray-300 bg-white">
                        <span className="text-sm font-medium">
                            Response {responseHistory.length - currentHistoryIndex} of {responseHistory.length}
                        </span>
                        <span className="text-xs text-gray-500 ml-2">
                            {responseHistory[currentHistoryIndex] ?
                                formatDate(responseHistory[currentHistoryIndex].date) : ''}
                        </span>
                    </div>

                    <button
                        onClick={() => goToHistoryItem(currentHistoryIndex - 1)}
                        disabled={currentHistoryIndex <= 0}
                        className="px-3 py-1 rounded-r-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        title="Next response"
                    >
                        <span className="sr-only">Next</span>
                        <i className="fas fa-chevron-right"></i>
                    </button>
                </nav>
            </div>
        );
    };

    return (
        <div>
            <h2 className="text-xl font-semibold mb-4">Generate SpamAssassin Rules</h2>
            
            {/* Add shared workspace notification */}
            {workspace && workspace.isShared && (
                <div className={`p-4 mb-4 rounded-lg border-l-4 ${
                    workspace.permission === 'read' 
                        ? 'bg-yellow-50 border-yellow-400 text-yellow-700' 
                        : 'bg-blue-50 border-blue-400 text-blue-700'
                }`}>
                    <p>
                        <span className="font-medium">Shared workspace: </span>
                        {workspace.permission === 'read' 
                            ? 'You have read-only access. Rules cannot be modified.' 
                            : 'You have read and write access to this workspace.'}
                    </p>
                </div>
            )}

            {/* Summary */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-2">Selected Files:</h3>
                    <ul className="list-disc pl-6">
                        {emailFiles.map(file => (
                            <li key={file.id}>{file.original_filename}</li>
                        ))}
                    </ul>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-2">Selected Headers:</h3>
                    <ul className="list-disc pl-6">
                        {selectedHeaders.map(header => (
                            <li key={header}>{header}</li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Base Prompt Selection */}
            <div className="mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-3">Base Prompt:</h3>
                    {basePrompts.length === 0 ? (
                        <p className="text-gray-500">No base prompts available</p>
                    ) : basePrompts.length === 1 ? (
                        <div className="text-gray-700 py-2 px-3 bg-indigo-50 border border-indigo-100 rounded flex items-center">
                            <span className="font-medium">{basePrompts[0].name}</span>
                            {promptMetadata?.base_prompt?.id === basePrompts[0].id && (
                                <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                                    Currently Used
                                </span>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="text-sm text-gray-600 mb-2">
                                Select a base prompt for rule generation:
                            </div>
                            <select
                                value={selectedBasePrompt || ''}
                                onChange={(e) => setSelectedBasePrompt(e.target.value)}
                                className={`w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                                    isReadOnly ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                                disabled={isReadOnly}
                            >
                                <option value="">-- Select a base prompt --</option>
                                {basePrompts.map(prompt => (
                                    <option key={prompt.id} value={prompt.id}>
                                        {prompt.name}
                                        {promptMetadata?.base_prompt?.id === prompt.id ? ' (Currently Used)' : ''}
                                    </option>
                                ))}
                            </select>
                            {promptMetadata?.base_prompt?.name && (
                                <div className="mt-2 text-sm">
                                    <span className="text-gray-500">Currently using:</span>
                                    <span className="ml-1 font-medium">{promptMetadata.base_prompt.name}</span>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Module Selection */}
            <ModuleSelector
                selectedModules={selectedModules}
                setSelectedModules={isReadOnly ? () => {} : setSelectedModules}
                disabled={isReadOnly}
            />

            {/* Prompt Editor */}
            <PromptEditor
                prompt={prompt}
                customPrompt={customPrompt}
                setCustomPrompt={isReadOnly ? () => {} : setCustomPrompt}
                isLoading={promptLoading}
                onResetPrompt={() => !isReadOnly && setCustomPrompt(prompt)}
                disabled={isReadOnly}
            />

            {/* Generation Status */}
            {isGenerating && (
                <div className="mb-6 p-4 rounded-lg bg-yellow-50 text-yellow-700">
                    <div className="flex items-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-yellow-700 mr-3"></div>
                        <span>
                            {isPolling
                                ? 'Generating rules... This may take a moment.'
                                : 'Preparing rule generation...'}
                        </span>
                    </div>
                </div>
            )}

            {/* Generation Result with Fixed Height and Scrolling */}
            {responseHistory.length > 0 && (
                <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold">Generated SpamAssassin Rule:</h3>
                        <button
                            onClick={copyToClipboard}
                            className="text-indigo-600 hover:text-indigo-800 flex items-center text-sm"
                        >
                            <i className="fas fa-copy mr-1"></i> Copy to Clipboard
                        </button>
                    </div>
                    <div className="border border-gray-200 rounded-lg">
                        <div
                            className="markdown-content p-4 overflow-y-auto h-96" // Fixed height with scrolling
                            dangerouslySetInnerHTML={{ __html: renderMarkdown() }}
                        ></div>
                    </div>

                    {/* History Pagination Controls */}
                    {renderHistoryPagination()}
                </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-6">
                <button
                    onClick={goToPreviousStep}
                    className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 transition-colors"
                >
                    Back: Select Headers
                </button>
                <button
                    onClick={generateRules}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    disabled={isGenerating || promptLoading || isReadOnly}
                >
                    {responseHistory.length > 0 ? 'Generate New Response' : 'Generate Rules'}
                </button>
            </div>
        </div>
    );
}

export default RuleGenerate;
