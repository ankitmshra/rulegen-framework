import React from 'react';

/**
 * Button component to export a rule from a code block
 * 
 * @param {object} rule - The rule object containing the rule content
 * @param {function} onExport - Function to call when the export button is clicked
 */
const CodeBlockExportButton = ({ rule, onExport }) => {
  const isSelected = rule.selected;

  return (
    <button
      onClick={() => onExport(rule)}
      className={`export-button ${isSelected ? 'bg-green-50 text-green-700 border-green-300' : ''}`}
      aria-label={isSelected ? "Rule selected for export" : "Export rule"}
      title={isSelected ? "Rule selected for export" : "Add rule to export list"}
    >
      {isSelected ? (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        </svg>
      )}
    </button>
  );
};

export default CodeBlockExportButton; 