/**
 * OpenAI-Compatible Provider
 * 
 * Works with any server that implements the OpenAI Chat API format:
 * - LM Studio (local)
 * - vLLM (local/cloud)
 * - LocalAI (local)
 * - Anyscale (cloud)
 * - Together AI (cloud)
 * - Groq (cloud)
 * - Azure OpenAI
 * - And many more...
 * 
 * @example
 * ```typescript
 * // LM Studio
 * const provider = new OpenAICompatibleProvider({
 *   model: 'local-model',
 *   baseUrl: 'http://localhost:1234/v1',
 * });
 * 
 * // Together AI
 * const provider = new OpenAICompatibleProvider({
 *   model: 'meta-llama/Llama-3-70b-chat-hf',
 *   baseUrl: 'https://api.together.xyz/v1',
 *   apiKey: process.env.TOGETHER_API_KEY,
 * });
 * ```
 */

import type {
  LlmProvider,
  LlmProviderConfig,
  ChatRequest,
  ChatResponse,
  ChatMessage,
  ToolCallResult,
  ToolSchema,
} from './types.js';

export interface OpenAICompatibleConfig extends LlmProviderConfig {
  /** Base URL for the API (required) */
  baseUrl: string;
  /** API key (optional for local servers) */
  apiKey?: string;
  /** Request timeout in ms (default: 120000) */
  timeout?: number;
  /** Custom headers to include */
  headers?: Record<string, string>;
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface OpenAIChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * OpenAI-Compatible LLM Provider
 * 
 * Connects to any server implementing the OpenAI Chat Completions API format.
 */
export class OpenAICompatibleProvider implements LlmProvider {
  readonly name: string;
  readonly model: string;
  
  private baseUrl: string;
  private apiKey?: string;
  private timeout: number;
  private headers: Record<string, string>;
  private defaultTemperature: number;
  private defaultMaxTokens?: number;

  constructor(config: OpenAICompatibleConfig) {
    this.model = config.model;
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? 120000;
    this.headers = config.headers ?? {};
    this.defaultTemperature = config.temperature ?? 0.7;
    this.defaultMaxTokens = config.maxTokens;
    
    // Set provider name based on URL
    if (this.baseUrl.includes('localhost') || this.baseUrl.includes('127.0.0.1')) {
      this.name = 'local-openai-compatible';
    } else if (this.baseUrl.includes('together')) {
      this.name = 'together';
    } else if (this.baseUrl.includes('groq')) {
      this.name = 'groq';
    } else if (this.baseUrl.includes('anyscale')) {
      this.name = 'anyscale';
    } else {
      this.name = 'openai-compatible';
    }
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const messages = this.convertMessages(request.messages);
    const tools = this.convertTools(request.tools);

    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      temperature: request.temperature ?? this.defaultTemperature,
    };

    if (request.maxTokens ?? this.defaultMaxTokens) {
      body['max_tokens'] = request.maxTokens ?? this.defaultMaxTokens;
    }

    if (tools && tools.length > 0) {
      body['tools'] = tools;
      
      // Convert tool choice
      if (request.toolChoice) {
        if (request.toolChoice === 'auto' || request.toolChoice === 'none') {
          body['tool_choice'] = request.toolChoice;
        } else if (request.toolChoice === 'required') {
          body['tool_choice'] = 'required';
        } else {
          // Specific tool name
          body['tool_choice'] = {
            type: 'function',
            function: { name: request.toolChoice },
          };
        }
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.headers,
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as OpenAIChatResponse;
      const choice = data.choices[0];

      if (!choice) {
        throw new Error('No response choice returned');
      }

      // Parse tool calls
      let toolCalls: ToolCallResult[] | undefined;
      if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
        toolCalls = choice.message.tool_calls.map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          argumentsJson: tc.function.arguments,
        }));
      }

      return {
        assistantText: choice.message.content ?? undefined,
        toolCalls,
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            }
          : undefined,
        finishReason: this.mapFinishReason(choice.finish_reason),
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Request timed out after ${this.timeout}ms`);
        }
        if (error.message.includes('ECONNREFUSED')) {
          throw new Error(
            `Cannot connect to ${this.baseUrl}. Make sure the server is running.`
          );
        }
        throw error;
      }
      throw new Error(`Request failed: ${String(error)}`);
    }
  }

  private convertMessages(messages: ChatMessage[]): OpenAIMessage[] {
    return messages.map((msg) => {
      const base: OpenAIMessage = {
        role: msg.role,
        content: msg.content,
      };

      if (msg.toolCallId) {
        base.tool_call_id = msg.toolCallId;
      }

      if (msg.toolCalls) {
        base.tool_calls = msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.name,
            arguments: tc.argumentsJson,
          },
        }));
      }

      return base;
    });
  }

  private convertTools(tools?: ToolSchema[]): OpenAITool[] | undefined {
    if (!tools || tools.length === 0) return undefined;

    return tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters as unknown as Record<string, unknown>,
      },
    }));
  }

  private mapFinishReason(
    reason: string
  ): 'stop' | 'tool_calls' | 'length' | 'content_filter' {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'tool_calls':
      case 'function_call':
        return 'tool_calls';
      case 'length':
        return 'length';
      case 'content_filter':
        return 'content_filter';
      default:
        return 'stop';
    }
  }
}
