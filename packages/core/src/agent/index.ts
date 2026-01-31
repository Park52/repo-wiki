/**
 * Agent Loop Implementation
 * Orchestrates LLM tool calls and manages conversation state
 */

import type {
  AgentConfig,
  AgentMessage,
  AgentResult,
  Source,
  LLMToolCall,
  DEFAULT_AGENT_CONFIG,
} from '../types.js';
import { LLMClient } from '../llm/index.js';
import { Indexer } from '../indexer/index.js';
import { executeTool, type ToolContext } from './tools.js';
import { verifySources, createVerificationErrorPrompt, formatSources } from './verifier.js';

const SYSTEM_PROMPT = `You are RepoWiki, an AI assistant that answers questions about code repositories.

You have access to the following tools:
- search_index: Search the repository index for relevant files
- read_file: Read contents of a specific file (with optional line range)
- list_files: List files in a directory
- final_answer: Provide your final answer (MUST include sources)

CRITICAL RULES:
1. ALWAYS use tools to gather information before answering
2. EVERY final_answer MUST include a non-empty sources array
3. Sources must reference actual files and line numbers you examined
4. Maximum steps allowed: {{maxSteps}}
5. Maximum lines per file excerpt: {{maxExcerptLines}}

Workflow:
1. Analyze the question
2. Use search_index to find relevant files
3. Use read_file to examine specific code sections
4. Use final_answer with answer and sources array

Example final_answer call:
{
  "answer": "The function calculates...",
  "sources": [
    {"path": "src/utils.ts", "startLine": 10, "endLine": 25},
    {"path": "src/index.ts", "startLine": 1, "endLine": 15}
  ]
}`;

export interface AgentOptions {
  config?: Partial<AgentConfig>;
  llmApiKey?: string;
  llmBaseURL?: string;
}

export class Agent {
  private config: AgentConfig;
  private llm: LLMClient;
  private indexer: Indexer;
  private toolContext: ToolContext;

  constructor(options: AgentOptions = {}) {
    this.config = {
      maxSteps: options.config?.maxSteps ?? 8,
      maxExcerptLines: options.config?.maxExcerptLines ?? 120,
      topK: options.config?.topK ?? 10,
      model: options.config?.model ?? 'gpt-4o',
      repoPath: options.config?.repoPath ?? process.cwd(),
    };

    this.llm = new LLMClient({
      apiKey: options.llmApiKey,
      baseURL: options.llmBaseURL,
      model: this.config.model,
    });

    this.indexer = new Indexer({
      repoPath: this.config.repoPath,
    });

    this.toolContext = {
      config: this.config,
      indexer: this.indexer,
    };
  }

  /**
   * Run the agent loop to answer a question
   */
  async run(question: string): Promise<AgentResult> {
    const systemPrompt = SYSTEM_PROMPT
      .replace('{{maxSteps}}', String(this.config.maxSteps))
      .replace('{{maxExcerptLines}}', String(this.config.maxExcerptLines));

    const messages: AgentMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question },
    ];

    let steps = 0;
    let retryCount = 0;
    const maxRetries = 2;

    while (steps < this.config.maxSteps) {
      steps++;

      try {
        const response = await this.llm.chat(messages);

        // If no tool calls, we're done (shouldn't happen with proper prompting)
        if (response.toolCalls.length === 0) {
          if (response.content) {
            return {
              answer: response.content,
              sources: [],
              steps,
              success: false,
              error: 'No sources provided in response',
            };
          }
          continue;
        }

        // Add assistant message with tool calls
        messages.push({
          role: 'assistant',
          content: response.content ?? '',
          toolCalls: response.toolCalls,
        });

        // Process each tool call
        for (const toolCall of response.toolCalls) {
          const { name, args } = LLMClient.parseToolArgs<Record<string, unknown>>(toolCall);
          const result = executeTool(name, args, this.toolContext);

          // Add tool result to messages
          messages.push({
            role: 'tool',
            content: result.content,
            toolCallId: toolCall.id,
          });

          // Check if this is a final answer
          if (result.isFinalAnswer && result.sources) {
            const verification = verifySources(result.sources, this.config);

            if (verification.valid) {
              return {
                answer: result.answer!,
                sources: result.sources,
                steps,
                success: true,
              };
            }

            // Verification failed - retry if possible
            if (retryCount < maxRetries) {
              retryCount++;
              messages.push({
                role: 'user',
                content: createVerificationErrorPrompt(verification),
              });
            } else {
              return {
                answer: result.answer!,
                sources: result.sources,
                steps,
                success: false,
                error: `Source verification failed after ${maxRetries} retries: ${verification.errors.join(', ')}`,
              };
            }
          }
        }
      } catch (error) {
        return {
          answer: '',
          sources: [],
          steps,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    return {
      answer: '',
      sources: [],
      steps,
      success: false,
      error: `Exceeded maximum steps (${this.config.maxSteps})`,
    };
  }

  /**
   * Index the repository before running queries
   */
  async indexRepository(): Promise<{ indexed: number; skipped: number }> {
    return this.indexer.indexRepository();
  }

  /**
   * Clean up resources
   */
  close(): void {
    this.indexer.close();
  }
}

export { formatSources };

// New Agent Loop exports
export { runAgent } from './loop.js';
export type {
  AgentLoopConfig,
  AgentLoopResult,
  StepLog,
} from './loop.js';
export { DEFAULT_AGENT_LOOP_CONFIG } from './loop.js';

// Prompt utilities
export {
  generateSystemPrompt,
  generateRepairPrompt,
  formatToolDescriptions,
} from './prompt.js';
