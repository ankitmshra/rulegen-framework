import React, { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';

// Initialize marked with syntax highlighting
marked.setOptions({
  highlight: function(code, lang) {
    try {
      return hljs.highlight(code, { language: lang || 'plaintext' }).value;
    } catch (e) {
      return hljs.highlight(code, { language: 'plaintext' }).value;
    }
  }
});

const RuleViewer = ({
  generatedPrompt,
  rules,
  currentRuleIndex,
  onRuleIndexChange,
  onGenerateRule,
  isGenerating,
  error,
  onBack
}) => {
  const [promptVisible, setPromptVisible] = useState(false);
  const [copySuccess, setCopySuccess] = useState('');
  const ruleContainerRef = useRef(null);

  // Create HTML from markdown
  const createMarkdown = (content) => {
    if (!content) return '<p>No content available</p>';
    return marked(content);
  };

  // Copy rule to clipboard
  const copyToClipboard = () => {
    if (!rules[currentRuleIndex]?.rule) return;

    const textArea = document.createElement('textarea');
    textArea.value = rules[currentRuleIndex].rule;
    document.body.appendChild(textArea);
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      setCopySuccess(successful ? 'Copied!' : 'Failed to copy');
    } catch (err) {
      setCopySuccess('Failed to copy');
    }
    
    document.body.removeChild(textArea);
    
    // Clear the "Copied!" message after 2 seconds
    setTimeout(() => {
      setCopySuccess('');
    }, 2000);
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Get the current rule
  const currentRule = rules[currentRuleIndex] || {};
  const isRuleComplete = currentRule.is_complete;

  // Update marked container when rule changes
  useEffect(() => {
    if (ruleContainerRef.current && currentRule.rule) {
      ruleContainerRef.current.innerHTML = createMarkdown(currentRule.rule);
    }
  }, [currentRule]);

  return (
    <div className="px-6 py-5">
      <h3 className="text-lg font-medium text-gray-900 mb-2">Generated Rule</h3>
      <p className="text-sm text-gray-500 mb-6">
        Review and manage generated SpamAssassin rules.
      </p>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden rounded-lg mb-6">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              {rules.length > 0 
                ? `Rule ${currentRuleIndex + 1} of ${rules.length}` 
                : 'No Rules Generated'}
            </h3>
            {currentRule.created_at && (
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Generated: {formatDate(currentRule.created_at)}
              </p>
            )}
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={() => setPromptVisible(!promptVisible)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {promptVisible ? 'Hide Prompt' : 'Show Prompt'}
            </button>
            
            {rules.length > 0 && (
              <button
                onClick={copyToClipboard}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                disabled={!isRuleComplete}
              >
                {copySuccess || 'Copy Rule'}
              </button>
            )}
          </div>
        </div>

        {/* Prompt Collapsible Section */}
        {promptVisible && (
          <div className="px-4 py-5 sm:p-6 border-b border-gray-200">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Generated Prompt</h4>
            <div className="bg-gray-50 p-4 rounded-md">
              <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono overflow-auto max-h-60">
                {generatedPrompt}
              </pre>
            </div>
          </div>
        )}

        {/* Rule Content */}
        <div className="px-4 py-5 sm:p-6">
          {rules.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No rules generated yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                Click the "Generate Rule" button to create your first rule.
              </p>
            </div>
          ) : !isRuleComplete ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <h3 className="mt-2 text-sm font-medium text-gray-900">Generating rule...</h3>
              <p className="mt-1 text-sm text-gray-500">
                This may take a few moments to complete.
              </p>
            </div>
          ) : (
            <div 
              ref={ruleContainerRef}
              className="prose prose-sm max-w-none text-gray-900 overflow-auto max-h-96"
            >
              {/* This will be populated by the marked renderer */}
            </div>
          )}
        </div>

        {/* Pagination controls */}
        {rules.length > 1 && (
          <div className="px-4 py-3 bg-gray-50 text-right sm:px-6 flex justify-between items-center">
            <div className="flex space-x-2">
              <button
                onClick={() => onRuleIndexChange(0)}
                disabled={currentRuleIndex === 0}
                className={`inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-indigo-500 ${
                  currentRuleIndex === 0 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => onRuleIndexChange(currentRuleIndex - 1)}
                disabled={currentRuleIndex === 0}
                className={`inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-indigo-500 ${
                  currentRuleIndex === 0 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            </div>
            
            <span className="text-sm text-gray-700">
              Rule {currentRuleIndex + 1} of {rules.length}
            </span>
            
            <div className="flex space-x-2">
              <button
                onClick={() => onRuleIndexChange(currentRuleIndex + 1)}
                disabled={currentRuleIndex === rules.length - 1}
                className={`inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-indigo-500 ${
                  currentRuleIndex === rules.length - 1 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                onClick={() => onRuleIndexChange(rules.length - 1)}
                disabled={currentRuleIndex === rules.length - 1}
                className={`inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-indigo-500 ${
                  currentRuleIndex === rules.length - 1 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <svg className="mr-2 -ml-1 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Prompt Configuration
        </button>
        
        <button
          type="button"
          onClick={onGenerateRule}
          disabled={isGenerating}
          className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
            isGenerating ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isGenerating ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating...
            </>
          ) : (
            <>
              {rules.length > 0 ? 'Regenerate Rule' : 'Generate Rule'}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default RuleViewer;
