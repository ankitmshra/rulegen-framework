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
  onBack
}) => {
  const [modulesByType, setModulesByType] = useState({});
  
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
      <h3 className="text-lg font-medium text-gray-900 mb-2">Configure Prompt</h3>
      <p className="text-sm text-gray-500 mb-6">
        Select a base prompt and additional modules to customize the rule generation.
      </p>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Base Prompt Selection */}
        <div className="bg-white shadow overflow-hidden rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Base Prompt</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Choose the primary prompt to use for rule generation.
            </p>
          </div>

          <div className="px-4 py-5 sm:p-6">
            {basePrompts.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-4">
                No base prompts available
              </div>
            ) : (
              <div className="space-y-4">
                {basePrompts.map(prompt => (
                  <div key={prompt.id} className="relative flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id={`prompt-${prompt.id}`}
                        type="radio"
                        name="base-prompt"
                        checked={selectedBasePrompt === prompt.id}
                        onChange={() => onBasePromptChange(prompt.id)}
                        className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor={`prompt-${prompt.id}`} className="font-medium text-gray-700">
                        {prompt.name}
                      </label>
                      {prompt.description && (
                        <p className="text-gray-500">{prompt.description}</p>
                      )}
                      <div className="mt-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          Base
                        </span>
                        {prompt.visibility === 'global' && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            Global
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Prompt Modules Selection */}
        <div className="bg-white shadow overflow-hidden rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Prompt Modules</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Add additional modules to enhance the rule generation.
            </p>
          </div>

          <div className="px-4 py-5 sm:p-6">
            {Object.keys(modulesByType).length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-4">
                No prompt modules available
              </div>
            ) : (
              <div className="space-y-6">
                {Object.keys(modulesByType).map(type => (
                  <div key={type}>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">
                      {getModuleTypeName(type)}
                    </h4>
                    <div className="space-y-4 ml-2">
                      {modulesByType[type].map(module => (
                        <div key={module.id} className="relative flex items-start">
                          <div className="flex items-center h-5">
                            <input
                              id={`module-${module.id}`}
                              type="checkbox"
                              checked={selectedModules.includes(module.id)}
                              onChange={() => toggleModule(module.id)}
                              className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                            />
                          </div>
                          <div className="ml-3 text-sm">
                            <label htmlFor={`module-${module.id}`} className="font-medium text-gray-700">
                              {module.name}
                            </label>
                            {module.description && (
                              <p className="text-gray-500">{module.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
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
          Back to Header Selection
        </button>
        
        <button
          type="button"
          onClick={onGeneratePrompt}
          disabled={!selectedBasePrompt || isGenerating}
          className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
            (!selectedBasePrompt || isGenerating) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isGenerating ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating Prompt...
            </>
          ) : (
            <>
              Generate Prompt and Continue
              <svg className="ml-2 -mr-1 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default PromptEditor;
