/**
 * Core types for RepoWiki agent system
 */

// ============================================================================
// Agent Configuration
// ============================================================================

export interface AgentConfig {
  /** Maximum steps the agent can take (default: 8) */
  maxSteps: number;
  /** Maximum lines per excerpt (default: 120) */
  maxExcerptLines: number;
  /** Top K results for search (default: 10) */
  topK: number;
  /** LLM model to use */
  model: string;
  /** Repository root path */
  repoPath: string;
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  maxSteps: 8,
  maxExcerptLines: 120,
  topK: 10,
  model: 'gpt-4o',
  repoPath: process.cwd(),
};

// ============================================================================
// Tool Definitions
// ============================================================================

export type ToolName = 'search_index' | 'read_file' | 'list_files' | 'final_answer';

export interface ToolCall {
  tool: ToolName;
  args: Record<string, unknown>;
}

export interface SearchIndexArgs {
  query: string;
  topK?: number;
}

export interface ReadFileArgs {
  path: string;
  startLine?: number;
  endLine?: number;
}

export interface ListFilesArgs {
  directory: string;
  pattern?: string;
}

export interface FinalAnswerArgs {
  answer: string;
  sources: Source[];
}

// ============================================================================
// Sources & Verification
// ============================================================================

export interface Source {
  path: string;
  startLine: number;
  endLine: number;
}

export interface VerificationResult {
  valid: boolean;
  errors: string[];
}

// ============================================================================
// Agent Loop Types
// ============================================================================

export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: LLMToolCall[];
}

export interface LLMToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolResult {
  toolCallId: string;
  content: string;
  isError?: boolean;
}

export interface AgentResult {
  answer: string;
  sources: Source[];
  steps: number;
  success: boolean;
  error?: string;
}

// ============================================================================
// Indexer Types
// ============================================================================

export interface IndexedFile {
  id: number;
  path: string;
  content: string;
  embedding?: Float32Array;
  lastModified: number;
}

export interface SearchResult {
  path: string;
  score: number;
  snippet: string;
  startLine: number;
  endLine: number;
}

// ============================================================================
// Wiki Generation Types
// ============================================================================

export interface WikiConfig {
  outputDir: string;
  format: 'markdown' | 'html';
  sections: WikiSection[];
}

export interface WikiSection {
  title: string;
  query: string;
}

export interface WikiPage {
  title: string;
  content: string;
  sources: Source[];
}
