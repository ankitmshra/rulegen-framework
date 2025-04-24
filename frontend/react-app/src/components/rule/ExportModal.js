import React, { useState, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './codeblock.css';
import './form-elements.css';

const ExportModal = ({ isOpen, onClose, exportedRules, workspace }) => {
  const [filename, setFilename] = useState('spamassassin_rules');
  
  // Set default filename based on workspace name when the modal opens
  useEffect(() => {
    if (isOpen && workspace?.name) {
      // Replace spaces with underscores and make lowercase
      const sanitizedName = workspace.name.replace(/\s+/g, '_').toLowerCase();
      setFilename(sanitizedName);
    }
  }, [isOpen, workspace]);
  
  if (!isOpen) return null;

  // Download all rules as .cf file
  const handleDownload = () => {
    if (exportedRules.length === 0) return;

    // Combine all code blocks
    let allCodeBlocks = [];
    
    // Add a header comment with attribution
    const header = `# SpamAssassin rules combined from ${exportedRules.length} ${exportedRules.length === 1 ? 'rule' : 'rules'}\n# Exported on: ${new Date().toISOString()}\n\n`;
    
    // Add all code blocks without separators or individual block comments
    exportedRules.forEach(rule => {
      if (!rule) return;
      
      // Add the code block content directly if available
      if (rule.codeBlockText) {
        allCodeBlocks.push(rule.codeBlockText.trim());
      } else if (rule.rule) {
        // Extract code blocks from the rule content as fallback
        const ruleContent = rule.rule;
        const codeBlockRegex = /```(?:\w*\n)?([\s\S]*?)```/g;
        let match;
        
        // Find all code blocks in this rule
        while ((match = codeBlockRegex.exec(ruleContent)) !== null) {
          // The actual code content is in the first capturing group
          allCodeBlocks.push(match[1].trim());
        }
      }
    });

    // Combine all code blocks with proper spacing
    const combinedCode = allCodeBlocks.join('\n\n');

    // Create final content with just header and code
    const fullContent = header + combinedCode;

    // Create a blob with the combined content
    const blob = new Blob([fullContent], { type: 'text/plain' });

    // Create a temporary URL for the blob
    const url = URL.createObjectURL(blob);

    // Create a temporary link element
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.cf') ? filename : `${filename}.cf`;

    // Append the link to the document, click it, and remove it
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the URL object
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  {exportedRules.length > 0
                    ? `${exportedRules.length} Rule${exportedRules.length !== 1 ? 's' : ''} Ready for Download`
                    : 'No Rules Exported'}
                </h3>
                <div className="mt-1 max-w-2xl text-sm text-gray-500">
                  <p>Download as a clean SpamAssassin configuration file</p>
                </div>
              
                <div className="mt-4">
                  <div className="mb-4 border-b pb-4">
                    <div className="prose prose-sm max-w-none">
                      <div className="code-block-container">
                        <SyntaxHighlighter
                          language="perl"
                          style={prism}
                          showLineNumbers={false}
                          wrapLines={true}
                          wrapLongLines={true}
                          customStyle={{
                            backgroundColor: '#f8fafc',
                            padding: '0.75rem',
                            borderRadius: '0.375rem',
                            fontSize: '0.875rem',
                            color: '#334155',
                            margin: 0,
                            border: '1px solid #e2e8f0'
                          }}
                          codeTagProps={{
                            style: {
                              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                              wordBreak: 'break-word',
                              whiteSpace: 'pre-wrap'
                            }
                          }}
                        >
                          {`# SpamAssassin rules combined from ${exportedRules.length} ${exportedRules.length === 1 ? 'rule' : 'rules'}\n# Exported on: ${new Date().toISOString()}`}
                        </SyntaxHighlighter>
                      </div>
                    </div>
                  </div>
                  
                  <div className="max-h-96 overflow-y-auto pr-2">
                    {exportedRules.map((rule, index) => (
                      <div key={rule.blockId || index} className="mb-6 last:mb-0 border-b last:border-b-0 pb-6 last:pb-0">
                        <div className="prose prose-sm max-w-none">
                          {rule.codeBlockText ? (
                            <div className="code-block-container">
                              <SyntaxHighlighter
                                language="perl"
                                style={prism}
                                showLineNumbers={false}
                                wrapLines={true}
                                wrapLongLines={true}
                                customStyle={{
                                  backgroundColor: '#f8fafc',
                                  padding: '0.75rem',
                                  borderRadius: '0.375rem',
                                  fontSize: '0.875rem',
                                  color: '#334155',
                                  margin: 0,
                                  border: '1px solid #e2e8f0'
                                }}
                                codeTagProps={{
                                  style: {
                                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                                    wordBreak: 'break-word',
                                    whiteSpace: 'pre-wrap'
                                  }
                                }}
                              >
                                {rule.codeBlockText}
                              </SyntaxHighlighter>
                            </div>
                          ) : (
                            <SyntaxHighlighter
                              language="perl"
                              style={prism}
                              showLineNumbers={false}
                              wrapLines={true}
                              wrapLongLines={true}
                              customStyle={{
                                backgroundColor: '#f8fafc',
                                padding: '0.75rem',
                                borderRadius: '0.375rem',
                                fontSize: '0.875rem',
                                color: '#334155',
                                margin: 0,
                                border: '1px solid #e2e8f0'
                              }}
                              codeTagProps={{
                                style: {
                                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                                  wordBreak: 'break-word',
                                  whiteSpace: 'pre-wrap'
                                }
                              }}
                            >
                              {rule.rule.replace(/```/g, '')}
                            </SyntaxHighlighter>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-4">
                    <label htmlFor="filename" className="block text-sm font-medium text-gray-700">
                      Filename for export
                    </label>
                    <div className="mt-1 flex rounded-md shadow-sm">
                      <input
                        type="text"
                        name="filename"
                        id="filename"
                        className="focus:ring-indigo-500 focus:border-indigo-500 flex-1 block w-full rounded-md sm:text-sm border-gray-300 px-3 py-2 border"
                        placeholder="spamassassin_rules"
                        value={filename}
                        onChange={(e) => setFilename(e.target.value)}
                      />
                      <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-500 text-sm export-filename-addon">
                        .cf
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
              onClick={handleDownload}
              disabled={exportedRules.length === 0}
            >
              <svg className="-ml-0.5 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>
            <button
              type="button"
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportModal; 