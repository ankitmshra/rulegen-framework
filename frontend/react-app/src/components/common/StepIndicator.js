import React from 'react';

function StepIndicator({ steps, currentStep, navigateToStep }) {
    return (
        <div className="flex items-center justify-center w-full py-4">
            {steps.map((step, index) => (
                <React.Fragment key={index}>
                    {/* Step icon and label */}
                    <div
                        className={`flex flex-col items-center ${index <= currentStep
                                ? 'cursor-pointer'
                                : 'cursor-not-allowed opacity-50'
                            }`}
                        onClick={() => navigateToStep(index)}
                    >
                        <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${index < currentStep
                                    ? 'bg-indigo-600 text-white'
                                    : index === currentStep
                                        ? 'bg-indigo-100 text-indigo-600 border-2 border-indigo-600'
                                        : 'bg-gray-200 text-gray-600'
                                }`}
                        >
                            <i className={`fas ${step.icon}`}></i>
                        </div>
                        <span
                            className={`mt-2 text-sm ${index === currentStep ? 'font-semibold text-indigo-600' : 'text-gray-600'
                                }`}
                        >
                            {step.title}
                        </span>
                    </div>

                    {/* Connector line between steps */}
                    {index < steps.length - 1 && (
                        <div
                            className={`flex-grow h-0.5 mx-2 ${index < currentStep ? 'bg-indigo-600' : 'bg-gray-300'
                                }`}
                        ></div>
                    )}
                </React.Fragment>
            ))}
        </div>
    );
}

export default StepIndicator;
