/**
 * LLM Provider Types
 * Defines the interface for LLM providers and request/response structures
 */

// ============================================================================
// Message Types
// ============================================================================

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: MessageRole;
  content: string;
  /** Tool call ID (required when role is 'tool') */
  toolCallId?: string;
  /** Tool calls made by the assistant */
  toolCalls?: ToolCallResult[];
}

// ============================================================================
// Tool Schema Types (JSON Schema based)
// ============================================================================

export interface ToolSchema {
  name: string;
  description: string;
  parameters: JsonSchema;
}

export interface JsonSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  items?: JsonSchemaProperty;
  description?: string;
}

export interface JsonSchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null';
  description?: string;
  enum?: (string | number | boolean)[];
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  default?: unknown;
}

// ============================================================================
// Request / Response Types
// ============================================================================

export interface ChatRequest {
  /** Conversation messages */
  messages: ChatMessage[];
  /** Available tools for the LLM to call */
  tools?: ToolSchema[];
  /** Tool choice strategy: 'auto' | 'none' | 'required' | specific tool name */
  toolChoice?: 'auto' | 'none' | 'required' | string;
  /** Temperature for response generation (0-2) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
}

export interface ToolCallResult {
  /** Unique ID for the tool call */
  id: string;
  /** Tool name */
  name: string;
  /** Arguments as JSON string */
  argumentsJson: string;
}

export interface ChatResponse {
  /** Text content from the assistant (may be null if only tool calls) */
  assistantText?: string;
  /** Tool calls requested by the assistant */
  toolCalls?: ToolCallResult[];
  /** Usage statistics */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Finish reason */
  finishReason?: 'stop' | 'tool_calls' | 'length' | 'content_filter';
}

// ============================================================================
// Provider Interface
// ============================================================================

export interface LlmProviderConfig {
  /** Model name/identifier */
  model: string;
  /** API key (optional, can use env var) */
  apiKey?: string;
  /** Base URL for API (optional) */
  baseUrl?: string;
  /** Default temperature */
  temperature?: number;
  /** Default max tokens */
  maxTokens?: number;
}

/**
 * LLM Provider Interface
 * All LLM providers must implement this interface
 */
export interface LlmProvider {
  /** Provider name for identification */
  readonly name: string;
  
  /** Model being used */
  readonly model: string;

  /**
   * Send a chat request and receive a response
   * @param request - The chat request with messages and optional tools
   * @returns Promise resolving to the chat response
   */
  chat(request: ChatRequest): Promise<ChatResponse>;
}
