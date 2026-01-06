import React from 'react';
import { Check } from 'lucide-react';

interface StepIndicatorProps {
    currentStep: number;
    steps: {
        number: number;
        title: string;
        description: string;
    }[];
}

export default function StepIndicator({ currentStep, steps }: StepIndicatorProps) {
    return (
        <div className="mb-8">
            <div className="flex items-center justify-between max-w-3xl mx-auto">
                {steps.map((step, index) => (
                    <React.Fragment key={step.number}>
                        {/* Step Circle */}
                        <div className="flex flex-col items-center">
                            <div
                                className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all ${currentStep > step.number
                                    ? 'bg-emerald-500 text-white'
                                    : currentStep === step.number
                                        ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                                        : 'bg-zinc-200 text-zinc-500'
                                    }`}
                            >
                                {currentStep > step.number ? (
                                    <Check className="w-6 h-6" />
                                ) : (
                                    step.number
                                )}
                            </div>
                            <div className="mt-3 text-center">
                                <div
                                    className={`text-sm font-semibold ${currentStep >= step.number
                                        ? 'text-zinc-900'
                                        : 'text-zinc-500'
                                        }`}
                                >
                                    {step.title}
                                </div>
                                <div className="text-xs text-zinc-500 mt-1">
                                    {step.description}
                                </div>
                            </div>
                        </div>

                        {/* Connector Line */}
                        {index < steps.length - 1 && (
                            <div className="flex-1 h-1 mx-4 mb-12">
                                <div
                                    className={`h-full rounded transition-all ${currentStep > step.number
                                        ? 'bg-emerald-500'
                                        : 'bg-zinc-200'
                                        }`}
                                />
                            </div>
                        )}
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
}