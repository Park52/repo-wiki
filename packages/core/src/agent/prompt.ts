/**
 * System Prompt Template
 * Defines the agent's behavior, tool usage, and output format
 */

export interface PromptConfig {
  maxSteps: number;
  maxExcerptLines: number;
  toolDescriptions: string;
}

/**
 * Generate the system prompt for the agent
 */
export function generateSystemPrompt(config: PromptConfig): string {
  return `You are RepoWiki, an AI assistant that answers questions about code repositories.
You MUST provide evidence-based answers by examining actual code using the available tools.

## Available Tools
${config.toolDescriptions}

## Core Rules

1. **ALWAYS use tools first** - Never answer from memory. Search and read code to gather evidence.
2. **Evidence-based answers** - Every claim must be backed by specific code you examined.
3. **Maximum ${config.maxSteps} steps** - Plan efficiently. Each tool call is one step.
4. **Excerpt limit** - Each file excerpt is limited to ${config.maxExcerptLines} lines.

## Response Format

You MUST respond in exactly ONE of these two formats:

### Format A: Tool Call (to gather more information)
Simply make tool calls using the function calling interface. The tool results will be provided back to you.

### Format B: Final Answer (when you have enough evidence)
When ready to answer, respond with EXACTLY this format:

\`\`\`
DONE

<your answer in markdown>

## Sources
- \`path/to/file.ts\`:10-25
- \`path/to/another.ts\`:100-150
\`\`\`

## Sources Section Requirements (CRITICAL)

Your final answer MUST include a "## Sources" section with:
- At least ONE source
- Each source in format: \`- \\\`file/path\\\`:startLine-endLine\`
- Sources must reference files and lines you actually examined
- WITHOUT valid sources, your answer will be REJECTED and you must try again

## Workflow

1. Understand the question
2. Use \`search_chunks\` to find relevant code
3. Use \`get_excerpt\` to read specific sections
4. Use \`list_files\` or \`graph_neighbors\` if needed
5. When you have enough evidence, respond with DONE + answer + Sources

## Example Final Answer

\`\`\`
DONE

The \`Agent\` class implements the main orchestration loop. It:

1. Initializes the LLM client and indexer in the constructor
2. The \`run()\` method executes the agent loop:
   - Sends messages to LLM
   - Processes tool calls
   - Validates sources with verifier

The maximum steps is configurable via \`AgentConfig.maxSteps\`.

## Sources
- \`packages/core/src/agent/index.ts\`:15-45
- \`packages/core/src/types.ts\`:10-25
\`\`\`

Remember: No sources = rejected answer. Always cite your evidence!`;
}

/**
 * Generate repair prompt when verifier fails
 */
export function generateRepairPrompt(errors: string[]): string {
  return `Your answer was REJECTED because it lacks proper source citations.

Errors:
${errors.map((e) => `- ${e}`).join('\n')}

You MUST:
1. Use tools to find and examine relevant code
2. Provide a new answer with a proper "## Sources" section
3. Each source must be in format: \`- \\\`file/path\\\`:startLine-endLine\`

Use search_chunks or get_excerpt to gather evidence, then provide your answer with DONE.`;
}

/**
 * Generate forced termination prompt when max steps reached
 */
export function generateForcedTerminationPrompt(
  stepCount: number,
  gatheredEvidence: string[]
): string {
  return `Maximum steps (${stepCount}) reached. You must provide your best answer NOW with the evidence gathered.

Evidence gathered so far:
${gatheredEvidence.length > 0 ? gatheredEvidence.join('\n') : '(No evidence gathered)'}

Respond with DONE + your best answer based on available evidence.
If you have any sources from your examination, include them in the ## Sources section.
If you have no sources, explain that the question could not be fully answered due to step limit.`;
}

/**
 * Format tool descriptions for the system prompt
 */
export function formatToolDescriptions(
  tools: Array<{ name: string; description: string }>
): string {
  return tools
    .map((t) => `- **${t.name}**: ${t.description}`)
    .join('\n');
}
