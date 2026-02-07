/**
 * Ollama Provider
 * Connects to a local Ollama server for LLM inference
 * 
 * Ollama is a popular local LLM runner that supports many models:
 * - llama3, llama2
 * - mistral, mixtral
 * - codellama
 * - phi, gemma, etc.
 * 
 * @see https://ollama.ai
 */

import type {
  LlmProvider,
  LlmProviderConfig,
  ChatRequest,
  ChatResponse,
  ToolCallResult,
} from './types.js';

export interface OllamaProviderConfig extends LlmProviderConfig {
  /** Ollama server URL (default: http://localhost:11434) */
  baseUrl?: string;
  /** Keep model loaded in memory (default: true) */
  keepAlive?: string;
  /** Request timeout in ms (default: 120000) */
  timeout?: number;
}

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: OllamaToolCall[];
}

interface OllamaToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

interface OllamaTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface OllamaChatResponse {
  model: string;
  message: {
    role: string;
    content: string;
    tool_calls?: OllamaToolCall[];
  };
  done: boolean;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

/**
 * Ollama LLM Provider
 * 
 * @example
 * ```typescript
 * const provider = new OllamaProvider({
 *   model: 'llama3.1',
 *   baseUrl: 'http://localhost:11434',
 * });
 * 
 * const response = await provider.chat({
 *   messages: [{ role: 'user', content: 'Hello!' }],
 * });
 * ```
 */
export class OllamaProvider implements LlmProvider {
  readonly name = 'ollama';
  readonly model: string;
  
  private baseUrl: string;
  private keepAlive: string;
  private timeout: number;
  private defaultTemperature: number;

  constructor(config: OllamaProviderConfig) {
    this.model = config.model;
    this.baseUrl = (config.baseUrl ?? 'http://localhost:11434').replace(/\/$/, '');
    this.keepAlive = config.keepAlive ?? '5m';
    this.timeout = config.timeout ?? 120000;
    this.defaultTemperature = config.temperature ?? 0.7;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const messages: OllamaMessage[] = request.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Convert tools to Ollama format
    const tools: OllamaTool[] | undefined = request.tools?.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters as unknown as Record<string, unknown>,
      },
    }));

    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      stream: false,
      keep_alive: this.keepAlive,
      options: {
        temperature: request.temperature ?? this.defaultTemperature,
      },
    };

    // Only add tools if the model supports them and they're provided
    if (tools && tools.length > 0) {
      body['tools'] = tools;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as OllamaChatResponse;

      // Parse tool calls if present
      let toolCalls: ToolCallResult[] | undefined;
      if (data.message.tool_calls && data.message.tool_calls.length > 0) {
        toolCalls = data.message.tool_calls.map((tc, index) => ({
          id: `ollama_${Date.now()}_${index}`,
          name: tc.function.name,
          argumentsJson: JSON.stringify(tc.function.arguments),
        }));
      }

      return {
        assistantText: data.message.content || undefined,
        toolCalls,
        usage: {
          promptTokens: data.prompt_eval_count ?? 0,
          completionTokens: data.eval_count ?? 0,
          totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
        },
        finishReason: toolCalls ? 'tool_calls' : 'stop',
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Ollama request timed out after ${this.timeout}ms`);
        }
        // Connection refused - Ollama not running
        if (error.message.includes('ECONNREFUSED')) {
          throw new Error(
            `Cannot connect to Ollama at ${this.baseUrl}. ` +
            `Make sure Ollama is running: ollama serve`
          );
        }
        throw error;
      }
      throw new Error(`Ollama request failed: ${String(error)}`);
    }
  }

  /**
   * Check if Ollama server is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * List available models on the Ollama server
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) return [];
      
      const data = (await response.json()) as { models: Array<{ name: string }> };
      return data.models.map((m) => m.name);
    } catch {
      return [];
    }
  }
}
