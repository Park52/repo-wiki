/**
 * Tool Types
 * Core type definitions for the tool system
 */

import type { ToolSchema, JsonSchema } from '../llm/types.js';

// ============================================================================
// Tool Result Types
// ============================================================================

/**
 * Result returned by tool execution
 * Designed to be LLM-friendly with summary text
 */
export interface ToolResult<T = unknown> {
  /** Whether the tool executed successfully */
  success: boolean;
  /** The actual data returned by the tool */
  data: T;
  /** Human/LLM-readable summary of the result */
  outputSummary: string;
  /** Error message if success is false */
  error?: string;
}

// ============================================================================
// Tool Definition Types
// ============================================================================

/**
 * Context passed to tool handlers
 * Contains shared resources like indexer, repo path, etc.
 */
export interface ToolContext {
  /** Repository root path */
  repoPath: string;
  /** Indexer instance for search operations */
  indexer?: unknown; // Will be typed properly when integrated
  /** Additional context data */
  [key: string]: unknown;
}

/**
 * Tool handler function signature
 */
export type ToolHandler<TArgs = unknown, TResult = unknown> = (
  args: TArgs,
  context: ToolContext
) => Promise<ToolResult<TResult>>;

/**
 * Registered tool definition
 */
export interface RegisteredTool<TArgs = unknown, TResult = unknown> {
  /** Tool name (unique identifier) */
  name: string;
  /** Tool description for LLM */
  description: string;
  /** JSON schema for parameters */
  parametersSchema: JsonSchema;
  /** Zod schema for runtime validation */
  zodSchema: unknown; // Zod schema type
  /** Handler function */
  handler: ToolHandler<TArgs, TResult>;
}

// ============================================================================
// Tool Name Constants
// ============================================================================

export const TOOL_NAMES = {
  SEARCH_CHUNKS: 'search_chunks',
  GET_EXCERPT: 'get_excerpt',
  GRAPH_NEIGHBORS: 'graph_neighbors',
  LIST_FILES: 'list_files',
  GET_REPO_SUMMARY: 'get_repo_summary',
} as const;

export type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];

// ============================================================================
// Tool-specific Result Types
// ============================================================================

export interface ChunkSearchResult {
  path: string;
  startLine: number;
  endLine: number;
  content: string;
  score: number;
}

export interface ExcerptResult {
  path: string;
  startLine: number;
  endLine: number;
  content: string;
  totalLines: number;
}

export interface GraphNode {
  id: string;
  type: 'file' | 'function' | 'class' | 'module';
  name: string;
}

export interface GraphNeighbor {
  node: GraphNode;
  relation: 'imports' | 'exports' | 'calls' | 'extends' | 'implements';
  depth: number;
}

export interface FileEntry {
  path: string;
  type: 'file' | 'directory';
  size?: number;
}

export interface RepoSummary {
  name: string;
  totalFiles: number;
  totalLines: number;
  languages: Record<string, number>;
  topDirectories: string[];
  description?: string;
}
