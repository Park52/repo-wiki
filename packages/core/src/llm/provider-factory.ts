/**
 * Provider Factory
 * Creates LLM provider instances based on configuration
 */

import type { LlmProvider, LlmProviderConfig } from './types.js';
import { OpenAIProvider, type OpenAIProviderConfig } from './openai-provider.js';
import { OllamaProvider, type OllamaProviderConfig } from './ollama-provider.js';
import { OpenAICompatibleProvider, type OpenAICompatibleConfig } from './openai-compatible-provider.js';
import { AnthropicProvider, type AnthropicProviderConfig } from './anthropic-provider.js';

/**
 * Supported provider types
 */
export type ProviderType = 
  | 'openai'
  | 'anthropic'
  | 'ollama'
  | 'lmstudio'
  | 'together'
  | 'groq'
  | 'openai-compatible';

export interface ProviderFactoryConfig extends LlmProviderConfig {
  /** Provider type */
  provider: ProviderType;
  /** Base URL (for compatible providers) */
  baseUrl?: string;
  /** Additional headers */
  headers?: Record<string, string>;
}

/**
 * Default configurations for known providers
 */
const PROVIDER_DEFAULTS: Record<string, { baseUrl?: string; envKey?: string }> = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    envKey: 'OPENAI_API_KEY',
  },
  anthropic: {
    envKey: 'ANTHROPIC_API_KEY',
  },
  ollama: {
    baseUrl: 'http://localhost:11434',
  },
  lmstudio: {
    baseUrl: 'http://localhost:1234/v1',
  },
  together: {
    baseUrl: 'https://api.together.xyz/v1',
    envKey: 'TOGETHER_API_KEY',
  },
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    envKey: 'GROQ_API_KEY',
  },
};

/**
 * Create an LLM provider instance
 * 
 * @example
 * ```typescript
 * // OpenAI
 * const openai = createProvider({
 *   provider: 'openai',
 *   model: 'gpt-4o',
 * });
 * 
 * // Ollama (local)
 * const ollama = createProvider({
 *   provider: 'ollama',
 *   model: 'llama3.1',
 * });
 * 
 * // LM Studio (local)
 * const lmstudio = createProvider({
 *   provider: 'lmstudio',
 *   model: 'local-model',
 * });
 * 
 * // Together AI
 * const together = createProvider({
 *   provider: 'together',
 *   model: 'meta-llama/Llama-3-70b-chat-hf',
 * });
 * 
 * // Custom OpenAI-compatible
 * const custom = createProvider({
 *   provider: 'openai-compatible',
 *   model: 'my-model',
 *   baseUrl: 'https://my-api.example.com/v1',
 *   apiKey: 'my-key',
 * });
 * ```
 */
export function createProvider(config: ProviderFactoryConfig): LlmProvider {
  const defaults = PROVIDER_DEFAULTS[config.provider] ?? {};
  const apiKey = config.apiKey ?? (defaults.envKey ? process.env[defaults.envKey] : undefined);

  switch (config.provider) {
    case 'openai':
      return new OpenAIProvider({
        model: config.model,
        apiKey,
        baseUrl: config.baseUrl,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      } as OpenAIProviderConfig);

    case 'anthropic':
      return new AnthropicProvider({
        model: config.model,
        apiKey,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      } as AnthropicProviderConfig);

    case 'ollama':
      return new OllamaProvider({
        model: config.model,
        baseUrl: config.baseUrl ?? defaults.baseUrl,
        temperature: config.temperature,
      } as OllamaProviderConfig);

    case 'lmstudio':
    case 'together':
    case 'groq':
    case 'openai-compatible':
      return new OpenAICompatibleProvider({
        model: config.model,
        baseUrl: config.baseUrl ?? defaults.baseUrl ?? '',
        apiKey,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        headers: config.headers,
      } as OpenAICompatibleConfig);

    default:
      throw new Error(`Unknown provider type: ${config.provider}`);
  }
}

/**
 * Infer provider type from model name
 */
export function inferProviderFromModel(model: string): ProviderType {
  const modelLower = model.toLowerCase();

  if (modelLower.startsWith('gpt-') || modelLower.includes('openai')) {
    return 'openai';
  }
  if (modelLower.startsWith('claude-')) {
    return 'anthropic';
  }
  if (modelLower.includes('llama') || modelLower.includes('mistral') || modelLower.includes('mixtral')) {
    // Could be Ollama, Together, or Groq - default to Ollama for local
    return 'ollama';
  }
  
  // Default to OpenAI
  return 'openai';
}

/**
 * Get required environment variable for a provider
 */
export function getProviderEnvKey(provider: ProviderType): string | undefined {
  return PROVIDER_DEFAULTS[provider]?.envKey;
}
