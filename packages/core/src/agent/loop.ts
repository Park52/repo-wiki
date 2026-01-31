/**
 * Agent Loop Implementation
 * Main orchestration loop for the RepoWiki agent
 */

import type { LlmProvider, ChatMessage, ToolCallResult } from '../llm/types.js';
import type { Source } from '../types.js';
import { ToolRegistry, createToolRegistry } from '../tools/registry.js';
import { Indexer } from '../indexer/index.js';
import {
  generateSystemPrompt,
  generateRepairPrompt,
  generateForcedTerminationPrompt,
  formatToolDescriptions,
} from './prompt.js';
import type {
  AgentLoopConfig,
  AgentLoopResult,
  StepLog,
  ParsedLLMResponse,
  SourceVerificationResult,
  ContextMessage,
} from './loop-types.js';
import { DEFAULT_AGENT_LOOP_CONFIG } from './loop-types.js';

// ============================================================================
// Main Agent Loop Function
// ============================================================================

/**
 * Run the agent loop to answer a question about the repository
 */
export async function runAgent(config: AgentLoopConfig): Promise<AgentLoopResult> {
  const startTime = Date.now();
  
  const maxSteps = config.maxSteps ?? DEFAULT_AGENT_LOOP_CONFIG.maxSteps;
  const maxExcerptLines = config.maxExcerptLines ?? DEFAULT_AGENT_LOOP_CONFIG.maxExcerptLines;
  const maxToolOutputChars = config.maxToolOutputChars ?? DEFAULT_AGENT_LOOP_CONFIG.maxToolOutputChars;
  const verbose = config.verbose ?? DEFAULT_AGENT_LOOP_CONFIG.verbose;

  // Initialize indexer and tool registry
  const indexer = new Indexer({
    repoPath: config.repoRoot,
    dbPath: config.dbPath,
  });

  const toolRegistry = createToolRegistry(config.repoRoot, indexer);
  const toolSchemas = toolRegistry.getToolSchemas();

  // Build system prompt
  const toolDescriptions = formatToolDescriptions(
    toolSchemas.map((t) => ({ name: t.name, description: t.description }))
  );
  
  const systemPrompt = generateSystemPrompt({
    maxSteps,
    maxExcerptLines,
    toolDescriptions,
  });

  // Initialize conversation
  const messages: ContextMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: config.question },
  ];

  const steps: StepLog[] = [];
  const gatheredEvidence: string[] = [];
  
  let currentStep = 0;
  let finalAnswer: string | undefined;
  let verified = false;
  let verifiedSources: Source[] = [];
  let error: string | undefined;

  // Main loop
  while (currentStep < maxSteps) {
    currentStep++;
    const stepStart = Date.now();

    if (verbose) {
      console.log(`\n--- Step ${currentStep}/${maxSteps} ---`);
    }

    try {
      // Call LLM
      const response = await config.llmProvider.chat({
        messages: messages as ChatMessage[],
        tools: toolSchemas,
        toolChoice: 'auto',
      });

      const parsed = parseResponse(response.assistantText, response.toolCalls);
      
      if (parsed.type === 'error') {
        error = parsed.error;
        break;
      }

      // Handle tool calls
      if (parsed.type === 'tool_calls' && parsed.toolCalls && parsed.toolCalls.length > 0) {
        // Add assistant message with tool calls
        messages.push({
          role: 'assistant',
          content: parsed.rawContent ?? '',
          toolCalls: parsed.toolCalls,
        });

        // Execute each tool call
        for (const toolCall of parsed.toolCalls) {
          const toolResult = await toolRegistry.executeToolCall(
            toolCall.name,
            toolCall.argumentsJson
          );

          // Truncate output if too long
          const truncatedOutput = truncateOutput(
            toolResult.outputSummary,
            maxToolOutputChars
          );

          // Add to gathered evidence
          if (toolResult.success) {
            gatheredEvidence.push(`[${toolCall.name}] ${truncatedOutput.slice(0, 200)}...`);
          }

          // Add tool result message
          messages.push({
            role: 'tool',
            content: truncatedOutput,
            toolCallId: toolCall.id,
          });

          // Log step
          const stepLog: StepLog = {
            stepNo: currentStep,
            toolName: toolCall.name,
            toolInput: toolCall.argumentsJson,
            toolOutputSummary: truncatedOutput.slice(0, 500),
            elapsedMs: Date.now() - stepStart,
            modelMessageSummary: `Called ${toolCall.name}`,
            isDone: false,
          };
          steps.push(stepLog);

          if (verbose) {
            console.log(`Tool: ${toolCall.name}`);
            console.log(`Output: ${truncatedOutput.slice(0, 200)}...`);
          }
        }

        continue;
      }

      // Handle DONE response
      if (parsed.type === 'done' && parsed.answerMd) {
        // Verify sources
        const verification = verifySourcesInAnswer(parsed.answerMd, config.repoRoot);

        const stepLog: StepLog = {
          stepNo: currentStep,
          elapsedMs: Date.now() - stepStart,
          modelMessageSummary: 'Provided final answer',
          isDone: true,
          verifierPassed: verification.valid,
          verifierErrors: verification.errors,
        };
        steps.push(stepLog);

        if (verification.valid) {
          // Success!
          finalAnswer = parsed.answerMd;
          verified = true;
          verifiedSources = verification.sources;

          if (verbose) {
            console.log('Answer verified successfully!');
          }
          break;
        } else {
          // Verification failed - send repair prompt
          if (verbose) {
            console.log('Verification failed:', verification.errors);
          }

          messages.push({
            role: 'assistant',
            content: `DONE\n\n${parsed.answerMd}`,
          });
          messages.push({
            role: 'user',
            content: generateRepairPrompt(verification.errors),
          });

          // Continue loop for retry
          continue;
        }
      }

      // Unexpected response - log and continue
      const stepLog: StepLog = {
        stepNo: currentStep,
        elapsedMs: Date.now() - stepStart,
        modelMessageSummary: parsed.rawContent?.slice(0, 200) ?? 'Empty response',
        isDone: false,
      };
      steps.push(stepLog);

    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      const stepLog: StepLog = {
        stepNo: currentStep,
        elapsedMs: Date.now() - stepStart,
        modelMessageSummary: `Error: ${error}`,
        isDone: false,
      };
      steps.push(stepLog);
      break;
    }
  }

  // Handle max steps reached without valid answer
  if (!verified && !error) {
    // Try one final forced termination
    if (currentStep >= maxSteps) {
      try {
        messages.push({
          role: 'user',
          content: generateForcedTerminationPrompt(maxSteps, gatheredEvidence),
        });

        const response = await config.llmProvider.chat({
          messages: messages as ChatMessage[],
          tools: [], // No tools for forced answer
        });

        if (response.assistantText) {
          const parsed = parseResponse(response.assistantText, undefined);
          if (parsed.answerMd) {
            finalAnswer = parsed.answerMd;
            const verification = verifySourcesInAnswer(parsed.answerMd, config.repoRoot);
            verified = verification.valid;
            verifiedSources = verification.sources;
          } else {
            finalAnswer = response.assistantText;
          }
        }
      } catch {
        // Ignore errors in forced termination
      }

      if (!finalAnswer) {
        finalAnswer = `Unable to fully answer the question within ${maxSteps} steps.\n\n## Partial Information\n\n${gatheredEvidence.join('\n') || 'No evidence gathered.'}\n\n## Sources\n\n(No verified sources available)`;
        error = `Max steps (${maxSteps}) exceeded`;
      }
    }
  }

  // Cleanup
  indexer.close();

  return {
    answerMd: finalAnswer ?? 'No answer generated',
    steps,
    sources: verifiedSources,
    verified,
    totalMs: Date.now() - startTime,
    error,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse LLM response to determine if it's a tool call or final answer
 */
function parseResponse(
  content: string | undefined,
  toolCalls: ToolCallResult[] | undefined
): ParsedLLMResponse {
  // Check for tool calls first
  if (toolCalls && toolCalls.length > 0) {
    return {
      type: 'tool_calls',
      toolCalls,
      rawContent: content,
    };
  }

  // Check for DONE marker in content
  if (content) {
    const doneMatch = content.match(/^DONE\s*\n([\s\S]*)/i);
    if (doneMatch) {
      return {
        type: 'done',
        answerMd: doneMatch[1]?.trim() ?? '',
        rawContent: content,
      };
    }

    // Check if content contains a Sources section (might have skipped DONE)
    if (content.includes('## Sources') && content.includes('`')) {
      return {
        type: 'done',
        answerMd: content,
        rawContent: content,
      };
    }
  }

  // No clear signal - treat as error/unexpected
  return {
    type: 'error',
    rawContent: content,
    error: 'LLM response was neither a tool call nor a valid DONE answer',
  };
}

/**
 * Verify sources in the answer markdown
 */
function verifySourcesInAnswer(
  answerMd: string,
  repoRoot: string
): SourceVerificationResult {
  const errors: string[] = [];
  const sources: Source[] = [];

  // Find Sources section
  const sourcesMatch = answerMd.match(/##\s*Sources\s*\n([\s\S]*?)(?:\n##|$)/i);
  
  if (!sourcesMatch) {
    return {
      valid: false,
      sources: [],
      errors: ['Missing "## Sources" section in answer'],
    };
  }

  const sourcesSection = sourcesMatch[1] ?? '';
  
  // Parse source entries: - `path/to/file`:10-25 or - `path/to/file.ts`:10-25
  const sourcePattern = /[-*]\s*`([^`]+)`\s*:\s*(\d+)\s*-\s*(\d+)/g;
  let match;
  let foundAny = false;

  while ((match = sourcePattern.exec(sourcesSection)) !== null) {
    foundAny = true;
    const [, path, startStr, endStr] = match;
    
    if (!path || !startStr || !endStr) continue;

    const startLine = parseInt(startStr, 10);
    const endLine = parseInt(endStr, 10);

    // Basic validation
    if (isNaN(startLine) || isNaN(endLine)) {
      errors.push(`Invalid line numbers for ${path}`);
      continue;
    }

    if (startLine < 1 || endLine < startLine) {
      errors.push(`Invalid line range for ${path}: ${startLine}-${endLine}`);
      continue;
    }

    // File existence check is optional for now (might slow down)
    // Could add: fs.existsSync(path.join(repoRoot, filePath))

    sources.push({ path, startLine, endLine });
  }

  if (!foundAny) {
    errors.push('No valid sources found. Format must be: - `path/to/file`:startLine-endLine');
  }

  return {
    valid: errors.length === 0 && sources.length > 0,
    sources,
    errors,
  };
}

/**
 * Truncate tool output to fit context limits
 */
function truncateOutput(output: string, maxChars: number): string {
  if (output.length <= maxChars) {
    return output;
  }

  const halfLimit = Math.floor(maxChars / 2) - 50;
  const head = output.slice(0, halfLimit);
  const tail = output.slice(-halfLimit);

  return `${head}\n\n... [${output.length - maxChars} characters truncated] ...\n\n${tail}`;
}

// ============================================================================
// Export Types
// ============================================================================

export type {
  AgentLoopConfig,
  AgentLoopResult,
  StepLog,
  ParsedLLMResponse,
  SourceVerificationResult,
} from './loop-types.js';

export { DEFAULT_AGENT_LOOP_CONFIG } from './loop-types.js';
