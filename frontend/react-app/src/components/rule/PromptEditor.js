import React, { useState, useEffect } from 'react';

const PromptEditor = ({
  basePrompts,
  selectedBasePrompt,
  onBasePromptChange,
  modulePrompts,
  selectedModules,
  onModulesChange,
  onGeneratePrompt,
  isGenerating,
  error,
  onBack,
  emailFiles
}) => {
  const [modulesByType, setModulesByType] = useState({});
  
  // Count spam files
  const spamCount = emailFiles ? emailFiles.length : 0;
  
  // Group modules by type
  useEffect(() => {
    const groupedModules = modulePrompts.reduce((acc, module) => {
      const type = module.module_type || 'other';
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(module);
      return acc;
    }, {});
    
    setModulesByType(groupedModules);
  }, [modulePrompts]);

  // Handle module selection toggle
  const toggleModule = (moduleId) => {
    if (selectedModules.includes(moduleId)) {
      onModulesChange(selectedModules.filter(id => id !== moduleId));
    } else {
      onModulesChange([...selectedModules, moduleId]);
    }
  };

  // Function to get a readable module type name
  const getModuleTypeName = (type) => {
    const typeNames = {
      'scoring': 'Scoring Rules',
      'subrules': 'Meta Rules',
      'notes': 'Explanatory Notes',
      'uri': 'URI Detection',
      'html': 'HTML Content',
      'custom': 'Custom',
      'other': 'Other'
    };
    
    return typeNames[type] || type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <div className="px-6 py-5">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Configure Prompt</h3>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {/* Email Statistics */}
      <div className="mb-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-gray-800">
              Email Statistics: {spamCount} Spam
            </h3>
            <div className="mt-2 text-sm text-gray-700">
              <p>
                These spam emails will be used to generate detection rules.
                The more diverse the spam samples, the better the rules will be at catching similar spam.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Base Prompt Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Base Prompt
        </label>
        <select
          value={selectedBasePrompt || ''}
          onChange={(e) => onBasePromptChange(e.target.value)}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
        >
          <option value="">Select a base prompt</option>
          {basePrompts.map((prompt) => (
            <option key={prompt.id} value={prompt.id}>
              {prompt.name}
            </option>
          ))}
        </select>
      </div>

      {/* Module Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Additional Modules
        </label>
        <div className="space-y-4">
          {Object.entries(modulesByType).map(([type, modules]) => (
            <div key={type} className="border border-gray-200 rounded-md p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3">
                {getModuleTypeName(type)}
              </h4>
              <div className="space-y-2">
                {modules.map((module) => (
                  <div key={module.id} className="flex items-center">
                    <input
                      id={`module-${module.id}`}
                      type="checkbox"
                      checked={selectedModules.includes(module.id)}
                      onChange={() => toggleModule(module.id)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label
                      htmlFor={`module-${module.id}`}
                      className="ml-2 block text-sm text-gray-700"
                    >
                      {module.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Back
        </button>
        
        <button
          type="button"
          onClick={onGeneratePrompt}
          disabled={!selectedBasePrompt || isGenerating}
          className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
            (!selectedBasePrompt || isGenerating) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isGenerating ? 'Generating...' : 'Generate Prompt'}
        </button>
      </div>
    </div>
  );
};

export default PromptEditor;
