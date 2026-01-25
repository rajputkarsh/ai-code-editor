/**
 * Predefined prompt templates for common code analysis tasks
 * These templates help users quickly perform standard operations without writing prompts from scratch
 */

import { ChatContext } from './types';

export interface PromptTemplate {
    id: string;
    name: string;
    description: string;
    icon?: string;
    /**
     * Generate the prompt text based on the provided context
     * @param context - The code context (file or selection)
     * @param customInput - Optional user input to customize the template
     */
    generatePrompt: (context: ChatContext, customInput?: string) => string;
}

/**
 * Template: Explain Code
 * Provides step-by-step explanation of code logic
 */
export const EXPLAIN_CODE_TEMPLATE: PromptTemplate = {
    id: 'explain-code',
    name: 'Explain Code',
    description: 'Get a step-by-step explanation of how the code works',
    icon: '📖',
    generatePrompt: (context: ChatContext, customInput?: string) => {
        const codeBlock = context.selection?.text || context.content;
        const location = context.selection 
            ? `lines ${context.selection.startLine}-${context.selection.endLine} of ${context.fileName}`
            : `file ${context.fileName}`;

        return `Please explain the following ${context.language} code from ${location}:

\`\`\`${context.language}
${codeBlock}
\`\`\`

${customInput || 'Break down the logic step-by-step and explain what each part does. Focus on the key concepts and overall flow.'}`;
    },
};

/**
 * Template: Find Bugs
 * Analyzes code for potential issues, bugs, and edge cases
 */
export const FIND_BUGS_TEMPLATE: PromptTemplate = {
    id: 'find-bugs',
    name: 'Find Bugs',
    description: 'Identify potential bugs, errors, and edge cases',
    icon: '🐛',
    generatePrompt: (context: ChatContext, customInput?: string) => {
        const codeBlock = context.selection?.text || context.content;
        const location = context.selection 
            ? `lines ${context.selection.startLine}-${context.selection.endLine} of ${context.fileName}`
            : `file ${context.fileName}`;

        return `Please analyze the following ${context.language} code from ${location} for potential bugs and issues:

\`\`\`${context.language}
${codeBlock}
\`\`\`

${customInput || 'Look for:'}
- Logic errors or incorrect conditions
- Potential runtime errors (null/undefined, type errors, etc.)
- Edge cases that might not be handled
- Race conditions or async/await issues
- Resource leaks or memory issues
- Security vulnerabilities

For each issue found, explain:
1. What the problem is
2. Why it's problematic
3. What could go wrong
4. How to fix it`;
    },
};

/**
 * Template: Optimize Logic
 * Suggests performance and code quality improvements
 */
export const OPTIMIZE_LOGIC_TEMPLATE: PromptTemplate = {
    id: 'optimize-logic',
    name: 'Optimize Logic',
    description: 'Get suggestions for performance and code quality improvements',
    icon: '⚡',
    generatePrompt: (context: ChatContext, customInput?: string) => {
        const codeBlock = context.selection?.text || context.content;
        const location = context.selection 
            ? `lines ${context.selection.startLine}-${context.selection.endLine} of ${context.fileName}`
            : `file ${context.fileName}`;

        return `Please analyze the following ${context.language} code from ${location} and suggest optimizations:

\`\`\`${context.language}
${codeBlock}
\`\`\`

${customInput || 'Consider:'}
- Performance improvements (time and space complexity)
- Code readability and maintainability
- Best practices for ${context.language}
- Modern language features that could simplify the code
- Potential refactoring opportunities

For each suggestion:
1. Explain what could be improved
2. Why the improvement matters
3. Show the optimized approach
4. Discuss any trade-offs`;
    },
};

/**
 * Template: Add Comments/Documentation
 * Generates helpful comments and documentation
 */
export const ADD_DOCUMENTATION_TEMPLATE: PromptTemplate = {
    id: 'add-documentation',
    name: 'Add Documentation',
    description: 'Generate helpful comments and documentation',
    icon: '📝',
    generatePrompt: (context: ChatContext, customInput?: string) => {
        const codeBlock = context.selection?.text || context.content;
        const location = context.selection 
            ? `lines ${context.selection.startLine}-${context.selection.endLine} of ${context.fileName}`
            : `file ${context.fileName}`;

        return `Please suggest documentation for the following ${context.language} code from ${location}:

\`\`\`${context.language}
${codeBlock}
\`\`\`

${customInput || 'Provide:'}
- Clear function/class documentation (JSDoc, docstrings, etc.)
- Inline comments for complex logic
- Parameter descriptions
- Return value descriptions
- Usage examples if applicable

Keep comments concise and valuable - explain the "why" not just the "what".`;
    },
};

/**
 * Template: Convert/Refactor
 * Helps with code transformation tasks
 */
export const CONVERT_REFACTOR_TEMPLATE: PromptTemplate = {
    id: 'convert-refactor',
    name: 'Convert/Refactor',
    description: 'Transform code to use different patterns or languages',
    icon: '🔄',
    generatePrompt: (context: ChatContext, customInput?: string) => {
        const codeBlock = context.selection?.text || context.content;
        const location = context.selection 
            ? `lines ${context.selection.startLine}-${context.selection.endLine} of ${context.fileName}`
            : `file ${context.fileName}`;

        return `I have the following ${context.language} code from ${location}:

\`\`\`${context.language}
${codeBlock}
\`\`\`

${customInput || 'Please help me refactor or convert this code. Explain your approach and reasoning.'}`;
    },
};

/**
 * Template: Security Review
 * Analyzes code for security vulnerabilities
 */
export const SECURITY_REVIEW_TEMPLATE: PromptTemplate = {
    id: 'security-review',
    name: 'Security Review',
    description: 'Check for security vulnerabilities and issues',
    icon: '🔒',
    generatePrompt: (context: ChatContext, customInput?: string) => {
        const codeBlock = context.selection?.text || context.content;
        const location = context.selection 
            ? `lines ${context.selection.startLine}-${context.selection.endLine} of ${context.fileName}`
            : `file ${context.fileName}`;

        return `Please perform a security review of the following ${context.language} code from ${location}:

\`\`\`${context.language}
${codeBlock}
\`\`\`

${customInput || 'Check for:'}
- Input validation issues
- SQL/NoSQL injection vulnerabilities
- XSS (Cross-Site Scripting) risks
- Authentication/authorization issues
- Sensitive data exposure
- Insecure dependencies or APIs
- CSRF vulnerabilities
- Information disclosure

For each security concern:
1. Describe the vulnerability
2. Explain the potential impact
3. Suggest remediation steps`;
    },
};

/**
 * All available prompt templates
 * Templates marked as "MVP" are required for Phase 4.3
 */
export const PROMPT_TEMPLATES: PromptTemplate[] = [
    EXPLAIN_CODE_TEMPLATE,      // MVP - Phase 4.3
    FIND_BUGS_TEMPLATE,         // MVP - Phase 4.3
    OPTIMIZE_LOGIC_TEMPLATE,    // MVP - Phase 4.3
    ADD_DOCUMENTATION_TEMPLATE, // Nice to have
    CONVERT_REFACTOR_TEMPLATE,  // Nice to have
    SECURITY_REVIEW_TEMPLATE,   // Nice to have
];

/**
 * Get a template by ID
 */
export function getTemplateById(id: string): PromptTemplate | undefined {
    return PROMPT_TEMPLATES.find((template) => template.id === id);
}

/**
 * Get MVP templates (required for Phase 4.3)
 */
export function getMVPTemplates(): PromptTemplate[] {
    return [
        EXPLAIN_CODE_TEMPLATE,
        FIND_BUGS_TEMPLATE,
        OPTIMIZE_LOGIC_TEMPLATE,
    ];
}


