/**
 * Local Provider Stub
 * Placeholder implementation for local/offline LLM providers
 * 
 * This is a stub that can be extended to support:
 * - Ollama
 * - llama.cpp
 * - LM Studio
 * - Other local inference engines
 */

import type {
  LlmProvider,
  LlmProviderConfig,
  ChatRequest,
  ChatResponse,
} from './types.js';

export interface LocalProviderConfig extends LlmProviderConfig {
  /** Endpoint URL for local server (e.g., http://localhost:11434) */
  endpoint?: string;
  /** Provider type: 'ollama' | 'llamacpp' | 'lmstudio' | 'custom' */
  providerType?: 'ollama' | 'llamacpp' | 'lmstudio' | 'custom';
}

/**
 * Local LLM Provider (Stub Implementation)
 * 
 * This is a placeholder that demonstrates the interface.
 * Actual implementation would connect to a local LLM server.
 */
export class LocalProvider implements LlmProvider {
  readonly name = 'local';
  readonly model: string;
  
  private endpoint: string;
  private providerType: string;

  constructor(config: LocalProviderConfig) {
    this.model = config.model;
    this.endpoint = config.endpoint ?? 'http://localhost:11434';
    this.providerType = config.providerType ?? 'ollama';
  }

  /**
   * Send a chat request to local LLM
   * 
   * @throws Error - This is a stub implementation
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    // Stub implementation - throws informative error
    throw new Error(
      `LocalProvider is a stub implementation. ` +
      `To use local LLMs, implement the chat method for your provider type: ${this.providerType}. ` +
      `Endpoint: ${this.endpoint}, Model: ${this.model}, ` +
      `Messages: ${request.messages.length}, Tools: ${request.tools?.length ?? 0}`
    );

    // TODO: Implement actual local provider logic
    // Example structure for Ollama:
    // 
    // const response = await fetch(`${this.endpoint}/api/chat`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     model: this.model,
    //     messages: request.messages.map(m => ({
    //       role: m.role,
    //       content: m.content,
    //     })),
    //     stream: false,
    //   }),
    // });
    // 
    // const data = await response.json();
    // return {
    //   assistantText: data.message?.content,
    //   toolCalls: undefined, // Local models may not support tool calls
    // };
  }

  /**
   * Check if the local provider is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(this.endpoint, { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * List available models from the local provider
   * Stub - returns empty array
   */
  async listModels(): Promise<string[]> {
    // TODO: Implement model listing
    // For Ollama: GET /api/tags
    // For LM Studio: GET /v1/models
    return [];
  }
}
