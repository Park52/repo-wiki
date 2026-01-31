/**
 * @repo-wiki/core
 * Core library for RepoWiki - agent loop, LLM client, and repository indexer
 */

// Types
export * from './types.js';

// Agent (legacy)
export { Agent, formatSources } from './agent/index.js';
export { executeTool, type ToolContext as LegacyToolContext, type ToolExecutionResult } from './agent/tools.js';
export { verifySources, createVerificationErrorPrompt, parseSourcesFromMarkdown, verifyMarkdownSources } from './agent/verifier.js';

// Agent Loop (new)
export {
  runAgent,
  DEFAULT_AGENT_LOOP_CONFIG,
  type AgentLoopConfig,
  type AgentLoopResult,
  type StepLog,
} from './agent/loop.js';
export {
  generateSystemPrompt,
  generateRepairPrompt,
  formatToolDescriptions,
} from './agent/prompt.js';

// LLM
export { LLMClient, type LLMClientConfig } from './llm/index.js';
export type { LlmProvider, ChatMessage, ToolSchema, JsonSchema, MessageRole } from './llm/types.js';
export { OpenAIProvider, type OpenAIProviderConfig } from './llm/openai-provider.js';
export { OllamaProvider, type OllamaProviderConfig } from './llm/ollama-provider.js';
export { OpenAICompatibleProvider, type OpenAICompatibleConfig } from './llm/openai-compatible-provider.js';
export { AnthropicProvider, type AnthropicProviderConfig } from './llm/anthropic-provider.js';
export { LocalProvider, type LocalProviderConfig } from './llm/local-provider.js';
export {
  createProvider,
  inferProviderFromModel,
  getProviderEnvKey,
  type ProviderType,
  type ProviderFactoryConfig,
} from './llm/provider-factory.js';

// Indexer
export { Indexer, type IndexerConfig } from './indexer/index.js';

// Tools (new system)
export {
  ToolRegistry,
  createToolRegistry,
  searchChunks,
  getExcerpt,
  graphNeighbors,
  listFiles,
  getRepoSummary,
  SearchChunksArgsSchema,
  GetExcerptArgsSchema,
  GraphNeighborsArgsSchema,
  ListFilesArgsSchema,
  GetRepoSummaryArgsSchema,
  zodToJsonSchema,
  TOOL_JSON_SCHEMAS,
  type SearchChunksArgs,
  type GetExcerptArgs,
  type GraphNeighborsArgs,
  type ListFilesArgs as NewListFilesArgs,
  type GetRepoSummaryArgs,
  type ToolResult as NewToolResult,
  type ToolContext as NewToolContext,
  type ToolHandler,
  type ToolDefinition,
  type ToolName as NewToolName,
} from './tools/index.js';

