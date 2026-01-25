/**
 * PromptTemplateSelector Component
 * Displays available prompt templates for quick actions
 */

import React from 'react';
import { PromptTemplate, getMVPTemplates } from '@/lib/ai/prompt-templates';

interface PromptTemplateSelectorProps {
    onSelectTemplate: (template: PromptTemplate) => void;
    disabled?: boolean;
}

export function PromptTemplateSelector({
    onSelectTemplate,
    disabled = false,
}: PromptTemplateSelectorProps) {
    const templates = getMVPTemplates();
    
    return (
        <div className="border-t border-neutral-700 p-3 bg-neutral-850">
            <div className="text-xs text-neutral-400 mb-2 font-medium">
                Quick Actions
            </div>
            <div className="flex flex-wrap gap-2">
                {templates.map((template) => (
                    <button
                        key={template.id}
                        onClick={() => onSelectTemplate(template)}
                        disabled={disabled}
                        className={`
                            flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium
                            transition-colors
                            ${
                                disabled
                                    ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                                    : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700 hover:text-white'
                            }
                        `}
                        title={template.description}
                    >
                        <span>{template.icon}</span>
                        <span>{template.name}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}


