/**
 * LLM Client for RepoWiki
 * Handles communication with OpenAI-compatible APIs
 */

import OpenAI from 'openai';
import type { AgentMessage, LLMToolCall, ToolName } from '../types.js';

// Re-export provider types and implementations
export * from './types.js';
export { OpenAIProvider, type OpenAIProviderConfig } from './openai-provider.js';
export { OllamaProvider, type OllamaProviderConfig } from './ollama-provider.js';
export { OpenAICompatibleProvider, type OpenAICompatibleConfig } from './openai-compatible-provider.js';
export { AnthropicProvider, type AnthropicProviderConfig } from './anthropic-provider.js';
export { LocalProvider, type LocalProviderConfig } from './local-provider.js';
export {
  createProvider,
  inferProviderFromModel,
  getProviderEnvKey,
  type ProviderType,
  type ProviderFactoryConfig,
} from './provider-factory.js';

// Tool schemas for function calling
const TOOL_SCHEMAS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_index',
      description: 'Search the repository index for relevant files and code snippets',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query to find relevant code',
          },
          topK: {
            type: 'number',
            description: 'Number of results to return (default: 10)',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Read contents of a file with optional line range',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the file relative to repo root',
          },
          startLine: {
            type: 'number',
            description: 'Start line (1-indexed, inclusive)',
          },
          endLine: {
            type: 'number',
            description: 'End line (1-indexed, inclusive)',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List files in a directory',
      parameters: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            description: 'Directory path relative to repo root',
          },
          pattern: {
            type: 'string',
            description: 'Glob pattern to filter files (e.g., "*.ts")',
          },
        },
        required: ['directory'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'final_answer',
      description: 'Provide the final answer with sources. MUST include sources array.',
      parameters: {
        type: 'object',
        properties: {
          answer: {
            type: 'string',
            description: 'The final answer to the user question',
          },
          sources: {
            type: 'array',
            description: 'Sources that support this answer. REQUIRED - cannot be empty.',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'File path' },
                startLine: { type: 'number', description: 'Start line number' },
                endLine: { type: 'number', description: 'End line number' },
              },
              required: ['path', 'startLine', 'endLine'],
            },
          },
        },
        required: ['answer', 'sources'],
      },
    },
  },
];

export interface LLMClientConfig {
  apiKey?: string;
  baseURL?: string;
  model: string;
}

export class LLMClient {
  private client: OpenAI;
  private model: string;

  constructor(config: LLMClientConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey ?? process.env['OPENAI_API_KEY'],
      baseURL: config.baseURL,
    });
    this.model = config.model;
  }

  /**
   * Send messages to LLM and get tool calls or response
   */
  async chat(messages: AgentMessage[]): Promise<{
    content: string | null;
    toolCalls: LLMToolCall[];
  }> {
    const openaiMessages = messages.map((msg) => this.toOpenAIMessage(msg));

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: openaiMessages,
      tools: TOOL_SCHEMAS,
      tool_choice: 'auto',
    });

    const choice = response.choices[0];
    if (!choice) {
      throw new Error('No response from LLM');
    }

    const toolCalls: LLMToolCall[] = (choice.message.tool_calls ?? []).map((tc) => ({
      id: tc.id,
      type: 'function' as const,
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments,
      },
    }));

    return {
      content: choice.message.content,
      toolCalls,
    };
  }

  private toOpenAIMessage(
    msg: AgentMessage
  ): OpenAI.Chat.ChatCompletionMessageParam {
    switch (msg.role) {
      case 'system':
        return { role: 'system', content: msg.content };
      case 'user':
        return { role: 'user', content: msg.content };
      case 'assistant':
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          return {
            role: 'assistant',
            content: msg.content,
            tool_calls: msg.toolCalls.map((tc) => ({
              id: tc.id,
              type: 'function' as const,
              function: {
                name: tc.function.name,
                arguments: tc.function.arguments,
              },
            })),
          };
        }
        return { role: 'assistant', content: msg.content };
      case 'tool':
        return {
          role: 'tool',
          content: msg.content,
          tool_call_id: msg.toolCallId!,
        };
      default:
        throw new Error(`Unknown message role: ${msg.role}`);
    }
  }

  /**
   * Parse tool call arguments safely
   */
  static parseToolArgs<T>(toolCall: LLMToolCall): { name: ToolName; args: T } {
    try {
      return {
        name: toolCall.function.name as ToolName,
        args: JSON.parse(toolCall.function.arguments) as T,
      };
    } catch {
      throw new Error(`Failed to parse tool arguments: ${toolCall.function.arguments}`);
    }
  }
}
