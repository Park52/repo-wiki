/**
 * OpenAI Provider Implementation
 * Implements LlmProvider interface for OpenAI API
 */

import OpenAI from 'openai';
import type {
  LlmProvider,
  LlmProviderConfig,
  ChatRequest,
  ChatResponse,
  ChatMessage,
  ToolSchema,
  ToolCallResult,
} from './types.js';

export interface OpenAIProviderConfig extends LlmProviderConfig {
  /** Organization ID (optional) */
  organization?: string;
  /** Request timeout in ms */
  timeout?: number;
}

export class OpenAIProvider implements LlmProvider {
  readonly name = 'openai';
  readonly model: string;
  
  private client: OpenAI;
  private defaultTemperature: number;
  private defaultMaxTokens?: number;

  constructor(config: OpenAIProviderConfig) {
    this.model = config.model;
    this.defaultTemperature = config.temperature ?? 0.7;
    this.defaultMaxTokens = config.maxTokens;

    // Use provided API key or fall back to environment variable
    const apiKey = config.apiKey ?? process.env['OPENAI_API_KEY'];
    
    if (!apiKey) {
      throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable or provide apiKey in config.');
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: config.baseUrl,
      organization: config.organization,
      timeout: config.timeout ?? 60000,
    });
  }

  /**
   * Send a chat request to OpenAI API
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const messages = this.convertMessages(request.messages);
    const tools = request.tools ? this.convertTools(request.tools) : undefined;
    
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      tools,
      tool_choice: this.convertToolChoice(request.toolChoice, tools),
      temperature: request.temperature ?? this.defaultTemperature,
      max_tokens: request.maxTokens ?? this.defaultMaxTokens,
    });

    return this.parseResponse(response);
  }

  /**
   * Convert internal message format to OpenAI format
   */
  private convertMessages(messages: ChatMessage[]): OpenAI.Chat.ChatCompletionMessageParam[] {
    return messages.map((msg): OpenAI.Chat.ChatCompletionMessageParam => {
      switch (msg.role) {
        case 'system':
          return { role: 'system', content: msg.content };
        
        case 'user':
          return { role: 'user', content: msg.content };
        
        case 'assistant':
          if (msg.toolCalls && msg.toolCalls.length > 0) {
            return {
              role: 'assistant',
              content: msg.content || null,
              tool_calls: msg.toolCalls.map((tc) => ({
                id: tc.id,
                type: 'function' as const,
                function: {
                  name: tc.name,
                  arguments: tc.argumentsJson,
                },
              })),
            };
          }
          return { role: 'assistant', content: msg.content };
        
        case 'tool':
          if (!msg.toolCallId) {
            throw new Error('Tool message must have toolCallId');
          }
          return {
            role: 'tool',
            content: msg.content,
            tool_call_id: msg.toolCallId,
          };
        
        default:
          throw new Error(`Unknown message role: ${msg.role}`);
      }
    });
  }

  /**
   * Convert internal tool schema to OpenAI format
   */
  private convertTools(tools: ToolSchema[]): OpenAI.Chat.ChatCompletionTool[] {
    return tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters as unknown as Record<string, unknown>,
      },
    }));
  }

  /**
   * Convert tool choice to OpenAI format
   */
  private convertToolChoice(
    toolChoice: ChatRequest['toolChoice'],
    tools?: OpenAI.Chat.ChatCompletionTool[]
  ): OpenAI.Chat.ChatCompletionToolChoiceOption | undefined {
    if (!tools || tools.length === 0) {
      return undefined;
    }

    if (!toolChoice || toolChoice === 'auto') {
      return 'auto';
    }

    if (toolChoice === 'none') {
      return 'none';
    }

    if (toolChoice === 'required') {
      return 'required';
    }

    // Specific tool name
    return {
      type: 'function',
      function: { name: toolChoice },
    };
  }

  /**
   * Parse OpenAI response to internal format
   */
  private parseResponse(response: OpenAI.Chat.ChatCompletion): ChatResponse {
    const choice = response.choices[0];
    
    if (!choice) {
      throw new Error('No response choice from OpenAI');
    }

    const message = choice.message;
    const toolCalls: ToolCallResult[] | undefined = message.tool_calls?.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      argumentsJson: tc.function.arguments,
    }));

    const finishReason = this.mapFinishReason(choice.finish_reason);

    return {
      assistantText: message.content ?? undefined,
      toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
      usage: response.usage ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      } : undefined,
      finishReason,
    };
  }

  /**
   * Map OpenAI finish reason to internal format
   */
  private mapFinishReason(
    reason: string | null
  ): ChatResponse['finishReason'] {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'tool_calls':
        return 'tool_calls';
      case 'length':
        return 'length';
      case 'content_filter':
        return 'content_filter';
      default:
        return undefined;
    }
  }
}
