/**
 * Anthropic Provider
 * Connects to Claude API (Anthropic)
 * 
 * Supports Claude models:
 * - claude-3-5-sonnet-latest
 * - claude-3-opus-latest
 * - claude-3-haiku-latest
 * 
 * @see https://docs.anthropic.com/en/api
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

export interface AnthropicProviderConfig extends LlmProviderConfig {
  /** Anthropic API key (or set ANTHROPIC_API_KEY env var) */
  apiKey?: string;
  /** API version (default: 2023-06-01) */
  apiVersion?: string;
  /** Request timeout in ms (default: 120000) */
  timeout?: number;
}

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

interface AnthropicContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Anthropic (Claude) LLM Provider
 * 
 * @example
 * ```typescript
 * const provider = new AnthropicProvider({
 *   model: 'claude-3-5-sonnet-latest',
 *   apiKey: process.env.ANTHROPIC_API_KEY,
 * });
 * 
 * const response = await provider.chat({
 *   messages: [{ role: 'user', content: 'Hello Claude!' }],
 * });
 * ```
 */
export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic';
  readonly model: string;
  
  private apiKey: string;
  private apiVersion: string;
  private baseUrl = 'https://api.anthropic.com';
  private timeout: number;
  private defaultTemperature: number;
  private defaultMaxTokens: number;

  constructor(config: AnthropicProviderConfig) {
    this.model = config.model;
    this.apiKey = config.apiKey ?? process.env['ANTHROPIC_API_KEY'] ?? '';
    this.apiVersion = config.apiVersion ?? '2023-06-01';
    this.timeout = config.timeout ?? 120000;
    this.defaultTemperature = config.temperature ?? 0.7;
    this.defaultMaxTokens = config.maxTokens ?? 4096;

    if (!this.apiKey) {
      throw new Error(
        'Anthropic API key is required. ' +
        'Set ANTHROPIC_API_KEY environment variable or pass apiKey in config.'
      );
    }
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    // Extract system message
    let systemPrompt: string | undefined;
    const messages: AnthropicMessage[] = [];

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        systemPrompt = msg.content;
      } else if (msg.role === 'tool') {
        // Convert tool response to Anthropic format
        // Tool responses must be in user messages with tool_result content
        const lastMsg = messages[messages.length - 1];
        if (lastMsg?.role === 'user' && Array.isArray(lastMsg.content)) {
          (lastMsg.content as AnthropicContentBlock[]).push({
            type: 'tool_result',
            tool_use_id: msg.toolCallId,
            content: msg.content,
          });
        } else {
          messages.push({
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: msg.toolCallId,
                content: msg.content,
              },
            ],
          });
        }
      } else if (msg.role === 'assistant' && msg.toolCalls) {
        // Assistant message with tool calls
        const content: AnthropicContentBlock[] = [];
        if (msg.content) {
          content.push({ type: 'text', text: msg.content });
        }
        for (const tc of msg.toolCalls) {
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: JSON.parse(tc.argumentsJson),
          });
        }
        messages.push({ role: 'assistant', content });
      } else {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }

    // Convert tools to Anthropic format
    const tools: AnthropicTool[] | undefined = request.tools?.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters as unknown as Record<string, unknown>,
    }));

    const body: Record<string, unknown> = {
      model: this.model,
      messages,
      max_tokens: request.maxTokens ?? this.defaultMaxTokens,
      temperature: request.temperature ?? this.defaultTemperature,
    };

    if (systemPrompt) {
      body['system'] = systemPrompt;
    }

    if (tools && tools.length > 0) {
      body['tools'] = tools;

      // Tool choice
      if (request.toolChoice === 'required') {
        body['tool_choice'] = { type: 'any' };
      } else if (request.toolChoice && request.toolChoice !== 'auto' && request.toolChoice !== 'none') {
        body['tool_choice'] = { type: 'tool', name: request.toolChoice };
      }
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': this.apiVersion,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = (errorData as { error?: { message?: string } })?.error?.message 
          ?? response.statusText;
        throw new Error(`Anthropic API error (${response.status}): ${errorMsg}`);
      }

      const data = (await response.json()) as AnthropicResponse;

      // Parse response content
      let assistantText: string | undefined;
      const toolCalls: ToolCallResult[] = [];

      for (const block of data.content) {
        if (block.type === 'text' && block.text) {
          assistantText = (assistantText ?? '') + block.text;
        } else if (block.type === 'tool_use' && block.id && block.name) {
          toolCalls.push({
            id: block.id,
            name: block.name,
            argumentsJson: JSON.stringify(block.input ?? {}),
          });
        }
      }

      return {
        assistantText,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage: {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens,
        },
        finishReason: this.mapStopReason(data.stop_reason),
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Anthropic request timed out after ${this.timeout}ms`);
        }
        throw error;
      }
      throw new Error(`Anthropic request failed: ${String(error)}`);
    }
  }

  private mapStopReason(
    reason: string
  ): 'stop' | 'tool_calls' | 'length' | 'content_filter' {
    switch (reason) {
      case 'end_turn':
      case 'stop_sequence':
        return 'stop';
      case 'tool_use':
        return 'tool_calls';
      case 'max_tokens':
        return 'length';
      default:
        return 'stop';
    }
  }
}
