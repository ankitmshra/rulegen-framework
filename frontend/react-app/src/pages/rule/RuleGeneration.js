import React, { useState, useEffect } from 'react';
import { emailFileAPI, promptTemplateAPI, ruleGenerationAPI } from '../../services/api';
import EmailUploader from '../../components/rule/EmailUploader';
import HeaderSelector from '../../components/rule/HeaderSelector';
import PromptEditor from '../../components/rule/PromptEditor';
import RuleViewer from '../../components/rule/RuleViewer';
import { motion, AnimatePresence } from 'framer-motion';

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

  // Direction state
  const [direction, setDirection] = useState(1); // 1 for forward, -1 for backward

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
        setDirection(1); // Set forward direction
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
    setDirection(1); // Set forward direction
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
      setDirection(1); // Set forward direction
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
    // Calculate positions for each step
    const totalSteps = steps.length;
    const currentIndex = steps.findIndex(step => step.id === currentStep);
    
    // Store previous index for animation direction
    const [prevIndex, setPrevIndex] = useState(currentIndex);
    
    // Update previous index when current changes
    useEffect(() => {
      // Only update after initial render
      if (prevIndex !== currentIndex) {
        setPrevIndex(currentIndex);
      }
    }, [currentIndex]);

    // Determine if transitioning forward or backward
    const isMovingForward = currentIndex >= prevIndex;

    return (
      <div className="mb-8">
        <div className="w-full">
          <div className="flex mb-4">
            {steps.map((step, stepIdx) => {
              const isClickable = step.canAccess;
              const isActive = step.id === currentStep;
              const isCompleted = step.completed;
              
              return (
                <motion.div 
                  key={step.id} 
                  className={`flex-1 text-center px-2 ${isClickable ? 'cursor-pointer hover:text-indigo-700' : 'cursor-default'}`}
                  onClick={() => isClickable && onStepClick(step.id)}
                  whileHover={isClickable ? { scale: 1.03 } : {}}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <div className="flex justify-center items-center">
                    <motion.div 
                      className={`
                        mr-1.5 w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0
                        ${isActive ? 'bg-indigo-600 text-white' : isCompleted ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'}
                      `}
                      animate={isActive ? { scale: [1, 1.1, 1] } : {}}
                      transition={{ duration: 0.8, repeat: isActive ? Infinity : 0, repeatDelay: 3 }}
                    >
                      {isCompleted ? 
                        <svg className="w-3 h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg> : 
                        stepIdx + 1
                      }
                    </motion.div>
                    <motion.span 
                      className={`
                        text-sm font-medium whitespace-nowrap
                        ${isActive ? 'text-indigo-600' : isCompleted ? 'text-gray-700' : 'text-gray-400'}
                      `}
                      animate={isActive ? { scale: 1.03 } : { scale: 1 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                      {step.name}
                    </motion.span>
                  </div>
                </motion.div>
              );
            })}
          </div>
          
          {/* New approach using background position */}
          <div className="relative h-1 w-full bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className="absolute top-0 left-0 bottom-0 bg-indigo-600 rounded-full"
              style={{
                originX: isMovingForward ? '0%' : '100%'
              }}
              initial={false}
              animate={{
                width: `${(currentIndex + 1) * (100 / totalSteps)}%`
              }}
              transition={{
                duration: 0.5,
                ease: "easeInOut"
              }}
            />
            
            {/* Step markers */}
            <div className="absolute top-0 bottom-0 left-0 right-0 flex">
              {steps.map((step, i) => {
                // Don't render a marker for the first position
                if (i === 0) return null;
                
                const position = (i * 100) / totalSteps;
                
                return (
                  <div
                    key={`marker-${i}`}
                    className="absolute w-1 h-1 bg-gray-400 rounded-full top-0 bottom-0 my-auto"
                    style={{ left: `${position}%` }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Handle clicking on a step
  const handleStepClick = (stepId) => {
    const currentIndex = steps.findIndex(step => step.id === activeStep);
    const newIndex = steps.findIndex(step => step.id === stepId);
    
    // Set direction based on step index comparison
    if (newIndex > currentIndex) {
      setDirection(1); // forward
    } else {
      setDirection(-1); // backward
    }
    
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

  // Also update these navigation functions
  const navigateToHeaders = () => {
    setDirection(-1);
    setActiveStep('headers');
  };

  const navigateToUpload = () => {
    setDirection(-1);
    setActiveStep('upload');
  };

  const navigateToPrompt = () => {
    setDirection(-1);
    setActiveStep('prompt');
  };

  const continueToHeaders = () => {
    setDirection(1);
    setActiveStep('headers');
  };

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
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={activeStep}
            custom={direction}
            initial={{ opacity: 0, x: direction * 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -20 }}
            transition={{ duration: 0.3 }}
          >
            {activeStep === 'upload' && (
              <EmailUploader 
                workspaceId={workspace.id} 
                existingFiles={emailFiles}
                onUploadSuccess={handleEmailUploadSuccess}
                onContinue={continueToHeaders}
              />
            )}

            {activeStep === 'headers' && (
              <HeaderSelector 
                availableHeaders={availableHeaders}
                selectedHeaders={selectedHeaders}
                onSelectHeaders={setSelectedHeaders}
                onContinue={handleHeaderSelectionDone}
                onBack={navigateToUpload}
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
                onBack={navigateToHeaders}
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
                onBack={navigateToPrompt}
                onPromptUpdate={handlePromptUpdate}
                workspace={workspace}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default RuleGeneration;
