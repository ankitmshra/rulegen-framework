import React, { useState, useEffect } from 'react';
import { emailFileAPI, promptTemplateAPI, ruleGenerationAPI } from '../../services/api';
import EmailUploader from '../../components/rule/EmailUploader';
import HeaderSelector from '../../components/rule/HeaderSelector';
import PromptEditor from '../../components/rule/PromptEditor';
import RuleViewer from '../../components/rule/RuleViewer';

const RuleGeneration = ({ workspace }) => {
  // Email file state
  const [emailFiles, setEmailFiles] = useState([]);
  const [availableHeaders, setAvailableHeaders] = useState({});
  const [selectedHeaders, setSelectedHeaders] = useState([]);
  
  // Prompt state
  const [basePrompts, setBasePrompts] = useState([]);
  const [selectedBasePrompt, setSelectedBasePrompt] = useState(null);
  const [modulePrompts, setModulePrompts] = useState([]);
  const [selectedModules, setSelectedModules] = useState([]);
  
  // Generated prompt and rules state
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [promptError, setPromptError] = useState(null);
  
  // Rule generation state
  const [generatedRules, setGeneratedRules] = useState([]);
  const [currentRuleIndex, setCurrentRuleIndex] = useState(0);
  const [isGeneratingRule, setIsGeneratingRule] = useState(false);
  const [ruleError, setRuleError] = useState(null);

  // Component state
  const [activeStep, setActiveStep] = useState('upload');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Check if steps are completable
  const canAccessHeaders = emailFiles.length > 0;
  const canAccessPrompt = canAccessHeaders && selectedHeaders.length > 0;
  const canAccessRules = canAccessPrompt && generatedPrompt !== '';

  // Determine the most advanced step we can show
  useEffect(() => {
    const determineInitialStep = () => {
      if (generatedRules.length > 0 && generatedPrompt !== '') {
        return 'rule';
      } else if (canAccessPrompt) {
        return 'prompt';
      } else if (canAccessHeaders) {
        return 'headers';
      }
      return 'upload';
    };

    if (dataLoaded) {
      const initialStep = determineInitialStep();
      setActiveStep(initialStep);
    }
  }, [dataLoaded, canAccessHeaders, canAccessPrompt, canAccessRules, generatedRules.length, generatedPrompt]);

  // Load previously generated rules when the component mounts
  useEffect(() => {
    const fetchExistingRules = async () => {
      if (!workspace || !workspace.id) return;
      
      try {
        setLoading(true);  // Show loading indicator when switching workspaces
        
        // Explicitly include the workspace ID and force a fresh fetch
        const response = await ruleGenerationAPI.getByWorkspace(workspace.id);
        
        if (response.data && response.data.length > 0) {
          // Sort rules by creation date descending (newest first)
          const sortedRules = response.data.sort((a, b) => 
            new Date(b.created_at) - new Date(a.created_at)
          );
          
          console.log(`Loaded ${sortedRules.length} rules for workspace ${workspace.id}`);
          setGeneratedRules(sortedRules);
          
          // If there are completed rules, set the first one as current
          const completedRules = sortedRules.filter(rule => rule.is_complete);
          if (completedRules.length > 0) {
            setCurrentRuleIndex(sortedRules.indexOf(completedRules[0]));
            
            // Get the prompt from the newest rule
            if (sortedRules[0].prompt) {
              setGeneratedPrompt(sortedRules[0].prompt);
            }
          }
        } else {
          // Clear rules if none found for this workspace
          console.log(`No rules found for workspace ${workspace.id}`);
          setGeneratedRules([]);
        }
      } catch (err) {
        console.error('Error fetching existing rules:', err);
        setGeneratedRules([]);  // Clear rules on error
      } finally {
        setLoading(false);
      }
    };
    
    fetchExistingRules();
  }, [workspace?.id]);

  // Effect for initial data loading
  useEffect(() => {
    const fetchInitialData = async () => {
      if (!workspace) return;
      
      try {
        setLoading(true);
        setError(null);

        // Load email files for this workspace
        const filesResponse = await emailFileAPI.getByWorkspace(workspace.id);
        setEmailFiles(filesResponse.data);

        // Load base prompts
        const basePromptsResponse = await promptTemplateAPI.getBasePrompts();
        setBasePrompts(basePromptsResponse.data);
        
        // Set first base prompt as default if available
        if (basePromptsResponse.data.length > 0) {
          setSelectedBasePrompt(basePromptsResponse.data[0].id);
        }

        // Load prompt modules
        const modulesResponse = await promptTemplateAPI.getPromptModules();
        setModulePrompts(modulesResponse.data);

        // If the workspace has selected headers, use them
        if (workspace.selected_headers?.length > 0) {
          setSelectedHeaders(workspace.selected_headers);
        }

        // If there are email files, fetch available headers
        if (filesResponse.data.length > 0) {
          const headersResponse = await emailFileAPI.getAvailableHeaders(workspace.id);
          setAvailableHeaders(headersResponse.data);
        }
        
        // Mark data as loaded to trigger step determination
        setDataLoaded(true);
      } catch (err) {
        console.error('Error fetching initial data:', err);
        setError('Failed to load initial data');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [workspace]);

  // Handle email file upload success
  const handleEmailUploadSuccess = async (newFiles, updatedFilesAfterDeletion) => {
    try {
      // If updated files list is provided (after deletion), use that
      if (updatedFilesAfterDeletion) {
        setEmailFiles(updatedFilesAfterDeletion);
      } else {
        // Otherwise add the new files to the existing list
        setEmailFiles([...newFiles, ...emailFiles]);
      }
      
      // Fetch available headers
      const headersResponse = await emailFileAPI.getAvailableHeaders(workspace.id);
      setAvailableHeaders(headersResponse.data);
      
      // Only move to headers step if this was an upload, not a deletion
      if (newFiles.length > 0 && !updatedFilesAfterDeletion) {
        setActiveStep('headers');
      }
    } catch (err) {
      console.error('Error processing uploaded files:', err);
      setError('Failed to process uploaded files');
    }
  };

  // Handle header selection
  const handleHeaderSelectionDone = async (headers) => {
    setSelectedHeaders(headers);
    
    // Update workspace selected headers
    try {
      await ruleGenerationAPI.generateDefaultPrompt({
        workspace_id: workspace.id,
        selected_headers: headers,
        base_prompt_id: selectedBasePrompt,
        prompt_modules: selectedModules
      });
    } catch (err) {
      console.error('Error updating selected headers:', err);
    }
    
    // Move to prompt step
    setActiveStep('prompt');
  };

  // Generate prompt with selected settings
  const handleGeneratePrompt = async () => {
    try {
      setIsGeneratingPrompt(true);
      setPromptError(null);

      const response = await ruleGenerationAPI.generateDefaultPrompt({
        workspace_id: workspace.id,
        selected_headers: selectedHeaders,
        base_prompt_id: selectedBasePrompt,
        prompt_modules: selectedModules
      });

      setGeneratedPrompt(response.data.prompt);
      setActiveStep('rule');
    } catch (err) {
      console.error('Error generating prompt:', err);
      setPromptError('Failed to generate prompt: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  // Generate rule with the prompt
  const handleGenerateRule = async (feedback = null) => {
    try {
      setIsGeneratingRule(true);
      setRuleError(null);

      // Determine if this is a regeneration (if we already have rules for this workspace)
      const isRegeneration = generatedRules.length > 0;

      let response;
      
      if (feedback) {
        // Sanitize feedback to prevent circular references
        const sanitizedFeedback = typeof feedback === 'string' ? feedback : String(feedback);
        
        // Use regenerateWithFeedback API when feedback is provided
        response = await ruleGenerationAPI.regenerateWithFeedback({
          workspace: workspace.id,
          prompt: generatedPrompt,
          prompt_modules: selectedModules,
          base_prompt_id: selectedBasePrompt,
          feedback: sanitizedFeedback
        });
      } else {
        // Use regular create API when no feedback is provided
        response = await ruleGenerationAPI.create({
          workspace: workspace.id,
          prompt: generatedPrompt,
          prompt_modules: selectedModules,
          base_prompt_id: selectedBasePrompt,
          is_regeneration: isRegeneration
        });
      }

      // Add new rule to the beginning of the list
      setGeneratedRules([response.data, ...generatedRules]);
      setCurrentRuleIndex(0);

      // Poll for rule generation completion
      pollRuleGeneration(response.data.id);
    } catch (err) {
      console.error('Error generating rule:', err);
      setRuleError('Failed to generate rule: ' + (err.response?.data?.error || err.message));
      setIsGeneratingRule(false);
    }
  };

  // Poll for rule generation completion
  const pollRuleGeneration = async (ruleId) => {
    try {
      const response = await ruleGenerationAPI.getStatus(ruleId);
      
      if (response.data.is_complete) {
        // Update the rule in the list
        setGeneratedRules(prevRules => 
          prevRules.map(rule => 
            rule.id === ruleId 
              ? { ...rule, rule: response.data.rule, is_complete: true } 
              : rule
          )
        );
        setIsGeneratingRule(false);
      } else {
        // Poll again after 2 seconds
        setTimeout(() => pollRuleGeneration(ruleId), 2000);
      }
    } catch (err) {
      console.error('Error polling rule status:', err);
      setRuleError('Failed to get rule status: ' + (err.response?.data?.error || err.message));
      setIsGeneratingRule(false);
    }
  };

  // Handle prompt update
  const handlePromptUpdate = (updatedPrompt) => {
    setGeneratedPrompt(updatedPrompt);
  };

  // Clickable step indicator component
  const StepIndicator = ({ steps, currentStep, onStepClick }) => {
    return (
      <div className="mb-8">
        <nav aria-label="Progress">
          <ol className="flex items-center">
            {steps.map((step, stepIdx) => {
              // Determine if this step is clickable
              const isClickable = step.canAccess;
              
              // Generate the appropriate class for the wrapper
              const wrapperClass = isClickable 
                ? "cursor-pointer hover:bg-gray-50 rounded-md px-2 py-1" 
                : "";
              
              return (
                <li key={step.id} className={`${stepIdx !== steps.length - 1 ? 'pr-8 sm:pr-20' : ''} relative`}>
                  {/* Click handler wrapper */}
                  <div 
                    className={wrapperClass}
                    onClick={() => isClickable && onStepClick(step.id)}
                    title={isClickable ? `Go to ${step.name}` : `Complete previous steps first`}
                  >
                    {/* Current step */}
                    {step.id === currentStep && (
                      <div className="flex items-center">
                        <div className="relative">
                          <div className="w-5 h-5 bg-indigo-200 rounded-full flex items-center justify-center">
                            <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full"></div>
                          </div>
                        </div>
                        <span className="ml-4 text-sm font-medium text-indigo-600">{step.name}</span>
                      </div>
                    )}
                    
                    {/* Completed step */}
                    {step.id !== currentStep && step.completed && (
                      <div className="flex items-center">
                        <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <span className="ml-4 text-sm font-medium text-gray-500">{step.name}</span>
                      </div>
                    )}
                    
                    {/* Upcoming step */}
                    {step.id !== currentStep && !step.completed && (
                      <div className="flex items-center">
                        <div className="w-5 h-5 bg-gray-200 rounded-full"></div>
                        <span className="ml-4 text-sm font-medium text-gray-500">{step.name}</span>
                      </div>
                    )}
                  </div>

                  {/* Connection line between steps */}
                  {stepIdx !== steps.length - 1 && (
                    <div className="hidden sm:block absolute top-0 right-0 h-full w-5" aria-hidden="true">
                      <svg className="h-full w-full text-gray-300" viewBox="0 0 22 80" fill="none" preserveAspectRatio="none">
                        <path d="M0 -2L20 40L0 82" vectorEffect="non-scaling-stroke" stroke="currentcolor" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
    );
  };

  // Handle clicking on a step
  const handleStepClick = (stepId) => {
    setActiveStep(stepId);
  };

  // Define steps for the workflow with accessibility flags
  const steps = [
    { 
      id: 'upload', 
      name: 'Upload Emails', 
      completed: emailFiles.length > 0,
      canAccess: true // Always accessible
    },
    { 
      id: 'headers', 
      name: 'Select Headers', 
      completed: selectedHeaders.length > 0 && activeStep !== 'headers',
      canAccess: canAccessHeaders 
    },
    { 
      id: 'prompt', 
      name: 'Configure Prompt', 
      completed: generatedPrompt !== '' && activeStep !== 'prompt',
      canAccess: canAccessPrompt
    },
    { 
      id: 'rule', 
      name: 'Generate Rules', 
      completed: generatedRules.length > 0,
      canAccess: generatedRules.length > 0 || canAccessRules
    }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
        <strong className="font-bold">Error!</strong>
        <span className="block sm:inline"> {error}</span>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-medium text-gray-900 mb-2">Rule Generation</h2>
      <p className="text-sm text-gray-500 mb-6">
        Generate SpamAssassin rules using spam email samples and configured prompts
      </p>

      {/* Interactive Step indicator */}
      <StepIndicator 
        steps={steps} 
        currentStep={activeStep} 
        onStepClick={handleStepClick}
      />

      {/* Content based on active step */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {activeStep === 'upload' && (
          <EmailUploader 
            workspaceId={workspace.id} 
            existingFiles={emailFiles}
            onUploadSuccess={handleEmailUploadSuccess}
            onContinue={() => setActiveStep('headers')}
          />
        )}

        {activeStep === 'headers' && (
          <HeaderSelector 
            availableHeaders={availableHeaders}
            selectedHeaders={selectedHeaders}
            onSelectHeaders={setSelectedHeaders}
            onContinue={handleHeaderSelectionDone}
            onBack={() => setActiveStep('upload')}
          />
        )}

        {activeStep === 'prompt' && (
          <PromptEditor
            basePrompts={basePrompts}
            selectedBasePrompt={selectedBasePrompt}
            onBasePromptChange={setSelectedBasePrompt}
            modulePrompts={modulePrompts}
            selectedModules={selectedModules}
            onModulesChange={setSelectedModules}
            onGeneratePrompt={handleGeneratePrompt}
            isGenerating={isGeneratingPrompt}
            error={promptError}
            onBack={() => setActiveStep('headers')}
            emailFiles={emailFiles}
          />
        )}

        {activeStep === 'rule' && (
          <RuleViewer
            generatedPrompt={generatedPrompt}
            rules={generatedRules}
            currentRuleIndex={currentRuleIndex}
            onRuleIndexChange={setCurrentRuleIndex}
            onGenerateRule={handleGenerateRule}
            isGenerating={isGeneratingRule}
            error={ruleError}
            onBack={() => setActiveStep('prompt')}
            onPromptUpdate={handlePromptUpdate}
          />
        )}
      </div>
    </div>
  );
};

export default RuleGeneration;
