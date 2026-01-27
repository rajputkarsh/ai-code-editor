export function extractJsonFromText(text: string): string {
    const trimmed = text.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        return trimmed;
    }

    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
        throw new Error('AI response did not contain JSON.');
    }

    return match[0];
}

