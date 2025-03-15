import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import FileUpload from './steps/FileUpload';
import HeaderSelection from './steps/HeaderSelection';
import RuleGenerate from './steps/RuleGenerate';
import StepIndicator from './common/StepIndicator';

function RuleGeneration({ workspace, setWorkspace }) {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(0);
    const [emailFiles, setEmailFiles] = useState([]);
    const [selectedHeaders, setSelectedHeaders] = useState([]);
    const [selectedModules, setSelectedModules] = useState([]);
    const [ruleGeneration, setRuleGeneration] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isNewWorkspace, setIsNewWorkspace] = useState(false);

    const steps = [
        { title: 'Upload Files', icon: 'fa-upload' },
        { title: 'Select Headers', icon: 'fa-list-ul' },
        { title: 'Generate Rules', icon: 'fa-magic' }
    ];

    // Check if this is a new workspace
    useEffect(() => {
        const isNew = localStorage.getItem('isNewWorkspace') === 'true';
        setIsNewWorkspace(isNew);

        // Clear the flag after reading it
        if (isNew) {
            localStorage.removeItem('isNewWorkspace');
        }
    }, []);

    // If workspace has a ruleGenerationId, load it
    useEffect(() => {
        if (workspace?.ruleGenerationId && !isNewWorkspace) {
            loadRuleGeneration(workspace.ruleGenerationId);
        } else if (isNewWorkspace) {
            // Reset state for new workspace
            setEmailFiles([]);
            setSelectedHeaders([]);
            setSelectedModules([]);
            setRuleGeneration(null);
            setCurrentStep(0);
        }
    }, [workspace, isNewWorkspace]);

    const loadRuleGeneration = async (ruleGenerationId) => {
        try {
            setIsLoading(true);
            const response = await api.get(`/api/rule-generations/${ruleGenerationId}/`);

            // Update state with loaded data
            setRuleGeneration(response.data);
            setEmailFiles(response.data.email_files || []);
            setSelectedHeaders(response.data.selected_headers || []);
            setSelectedModules(response.data.prompt_modules || []);

            // If rule generation is complete, go to the final step
            if (response.data.is_complete) {
                setCurrentStep(2);
            }
        } catch (error) {
            console.error('Error loading rule generation:', error);
            alert('Failed to load the workspace. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const goToNextStep = () => {
        setCurrentStep((prevStep) => Math.min(prevStep + 1, steps.length - 1));
    };

    const goToPreviousStep = () => {
        setCurrentStep((prevStep) => Math.max(prevStep - 1, 0));
    };

    const navigateToStep = (step) => {
        // Only allow navigating to a step if its prerequisites are met
        if (step === 0) {
            setCurrentStep(0);
        } else if (step === 1 && emailFiles.length > 0) {
            setCurrentStep(1);
        } else if (step === 2 && emailFiles.length > 0 && selectedHeaders.length > 0) {
            setCurrentStep(2);
        }
    };

    // Render current step
    const renderStep = () => {
        if (isLoading) {
            return (
                <div className="flex justify-center items-center p-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                    <p className="ml-3 text-lg text-gray-700">Loading workspace...</p>
                </div>
            );
        }

        switch (currentStep) {
            case 0:
                return (
                    <FileUpload
                        emailFiles={emailFiles}
                        setEmailFiles={setEmailFiles}
                        goToNextStep={goToNextStep}
                        workspace={workspace}
                    />
                );
            case 1:
                return (
                    <HeaderSelection
                        emailFiles={emailFiles}
                        selectedHeaders={selectedHeaders}
                        setSelectedHeaders={setSelectedHeaders}
                        goToNextStep={goToNextStep}
                        goToPreviousStep={goToPreviousStep}
                        workspace={workspace}
                    />
                );
            case 2:
                return (
                    <RuleGenerate
                        workspace={workspace}
                        emailFiles={emailFiles}
                        selectedHeaders={selectedHeaders}
                        selectedModules={selectedModules}
                        setSelectedModules={setSelectedModules}
                        ruleGeneration={ruleGeneration}
                        setRuleGeneration={setRuleGeneration}
                        goToPreviousStep={goToPreviousStep}
                    />
                );
            default:
                return <div>Unknown step</div>;
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <StepIndicator
                steps={steps}
                currentStep={currentStep}
                navigateToStep={navigateToStep}
            />
            <div className="mt-6">
                {renderStep()}
            </div>
        </div>
    );
}

export default RuleGeneration;
