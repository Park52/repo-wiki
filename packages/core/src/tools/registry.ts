/**
 * Tool Registry
 * Central registry for managing and executing tools
 */

import { z } from 'zod';
import type { ToolSchema } from '../llm/types.js';
import type { ToolContext, ToolResult, ToolName, TOOL_NAMES } from './types.js';
import {
  SearchChunksArgsSchema,
  GetExcerptArgsSchema,
  GraphNeighborsArgsSchema,
  ListFilesArgsSchema,
  GetRepoSummaryArgsSchema,
  zodToJsonSchema,
} from './schemas.js';
import {
  searchChunks,
  getExcerpt,
  graphNeighbors,
  listFiles,
  getRepoSummary,
} from './implementations.js';

// ============================================================================
// Tool Definitions with Metadata
// ============================================================================

export interface ToolDefinition {
  name: ToolName;
  description: string;
  schema: z.ZodTypeAny;
  handler: (args: unknown, context: ToolContext) => Promise<ToolResult>;
}

const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'search_chunks',
    description: 'Search indexed code chunks for relevant content. Returns matching code snippets with file paths and line numbers.',
    schema: SearchChunksArgsSchema,
    handler: searchChunks as (args: unknown, context: ToolContext) => Promise<ToolResult>,
  },
  {
    name: 'get_excerpt',
    description: 'Get a specific excerpt from a file by line range. Returns the content with line numbers.',
    schema: GetExcerptArgsSchema,
    handler: getExcerpt as (args: unknown, context: ToolContext) => Promise<ToolResult>,
  },
  {
    name: 'graph_neighbors',
    description: 'Find related code elements (imports, exports, dependencies) for a given file or symbol.',
    schema: GraphNeighborsArgsSchema,
    handler: graphNeighbors as (args: unknown, context: ToolContext) => Promise<ToolResult>,
  },
  {
    name: 'list_files',
    description: 'List files in the repository matching a glob pattern (e.g., "**/*.ts", "src/**/*.py").',
    schema: ListFilesArgsSchema,
    handler: listFiles as (args: unknown, context: ToolContext) => Promise<ToolResult>,
  },
  {
    name: 'get_repo_summary',
    description: 'Get an overview of the repository including file count, languages, and structure.',
    schema: GetRepoSummaryArgsSchema,
    handler: getRepoSummary as (args: unknown, context: ToolContext) => Promise<ToolResult>,
  },
];

// ============================================================================
// Tool Registry Class
// ============================================================================

export class ToolRegistry {
  private tools: Map<string, ToolDefinition>;
  private context: ToolContext;

  constructor(context: ToolContext) {
    this.context = context;
    this.tools = new Map();

    // Register all built-in tools
    for (const tool of TOOL_DEFINITIONS) {
      this.tools.set(tool.name, tool);
    }
  }

  /**
   * Execute a tool call by name
   * Validates arguments against schema before execution
   */
  async executeToolCall(name: string, argsJson: string | Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);

    if (!tool) {
      return {
        success: false,
        data: null,
        outputSummary: `Unknown tool: "${name}". Available tools: ${this.getToolNames().join(', ')}`,
        error: `Unknown tool: ${name}`,
      };
    }

    // Parse args if string
    let args: unknown;
    try {
      args = typeof argsJson === 'string' ? JSON.parse(argsJson) : argsJson;
    } catch (error) {
      return {
        success: false,
        data: null,
        outputSummary: `Failed to parse arguments: ${error instanceof Error ? error.message : String(error)}`,
        error: `Invalid JSON arguments`,
      };
    }

    // Validate against Zod schema
    const validation = tool.schema.safeParse(args);
    if (!validation.success) {
      const errors = validation.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join('; ');
      
      return {
        success: false,
        data: null,
        outputSummary: `Invalid arguments for "${name}": ${errors}`,
        error: `Validation failed: ${errors}`,
      };
    }

    // Execute the handler
    try {
      return await tool.handler(validation.data, this.context);
    } catch (error) {
      return {
        success: false,
        data: null,
        outputSummary: `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get all registered tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get tool schemas for LLM function calling
   */
  getToolSchemas(): ToolSchema[] {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.schema),
    }));
  }

  /**
   * Check if a tool exists
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get tool description
   */
  getToolDescription(name: string): string | undefined {
    return this.tools.get(name)?.description;
  }

  /**
   * Update context (e.g., when indexer becomes available)
   */
  updateContext(updates: Partial<ToolContext>): void {
    Object.assign(this.context, updates);
  }

  /**
   * Register a custom tool
   */
  registerTool(
    name: string,
    description: string,
    schema: z.ZodTypeAny,
    handler: (args: unknown, context: ToolContext) => Promise<ToolResult>
  ): void {
    this.tools.set(name, {
      name: name as ToolName,
      description,
      schema,
      handler,
    });
  }
}

/**
 * Create a ToolRegistry with default configuration
 */
export function createToolRegistry(repoPath: string, indexer?: unknown): ToolRegistry {
  return new ToolRegistry({
    repoPath,
    indexer,
  });
}
