/**
 * Tool Schemas
 * Zod schemas for runtime validation + TypeScript type inference
 * 
 * Why Zod: Single source of truth for both runtime validation and static types,
 * with excellent error messages and JSON Schema generation support.
 */

import { z } from 'zod';
import type { JsonSchema } from '../llm/types.js';

// ============================================================================
// Zod Schemas for Each Tool
// ============================================================================

/**
 * search_chunks - Search indexed code chunks
 */
export const SearchChunksArgsSchema = z.object({
  query: z.string().min(1).describe('Search query to find relevant code chunks'),
  topK: z.number().int().min(1).max(50).default(10).describe('Number of results to return'),
});

export type SearchChunksArgs = z.infer<typeof SearchChunksArgsSchema>;

/**
 * get_excerpt - Get file excerpt with line range
 */
export const GetExcerptArgsSchema = z.object({
  path: z.string().min(1).describe('File path relative to repository root'),
  startLine: z.number().int().min(1).describe('Start line number (1-indexed, inclusive)'),
  endLine: z.number().int().min(1).describe('End line number (1-indexed, inclusive)'),
});

export type GetExcerptArgs = z.infer<typeof GetExcerptArgsSchema>;

/**
 * graph_neighbors - Get related nodes in code graph
 */
export const GraphNeighborsArgsSchema = z.object({
  nodeId: z.string().min(1).describe('Node ID to find neighbors for (file path or symbol ID)'),
  depth: z.number().int().min(1).max(5).default(1).describe('Depth of neighbor traversal'),
});

export type GraphNeighborsArgs = z.infer<typeof GraphNeighborsArgsSchema>;

/**
 * list_files - List files matching glob pattern
 */
export const ListFilesArgsSchema = z.object({
  glob: z.string().min(1).describe('Glob pattern to match files (e.g., "**/*.ts")'),
  limit: z.number().int().min(1).max(1000).default(100).describe('Maximum number of files to return'),
});

export type ListFilesArgs = z.infer<typeof ListFilesArgsSchema>;

/**
 * get_repo_summary - Get repository overview
 */
export const GetRepoSummaryArgsSchema = z.object({});

export type GetRepoSummaryArgs = z.infer<typeof GetRepoSummaryArgsSchema>;

// ============================================================================
// JSON Schema Conversion Helpers
// ============================================================================

/**
 * Convert Zod schema to JSON Schema for LLM function calling
 */
export function zodToJsonSchema(zodSchema: z.ZodTypeAny): JsonSchema {
  // Basic implementation - handles common cases
  // For production, consider using zod-to-json-schema package
  
  if (zodSchema instanceof z.ZodObject) {
    const shape = zodSchema.shape;
    const properties: Record<string, JsonSchema> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const fieldSchema = value as z.ZodTypeAny;
      properties[key] = zodFieldToJsonSchema(fieldSchema);
      
      // Check if field is optional (has default or is explicitly optional)
      if (!fieldSchema.isOptional() && !(fieldSchema instanceof z.ZodDefault)) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties: properties as Record<string, import('../llm/types.js').JsonSchemaProperty>,
      required: required.length > 0 ? required : undefined,
    };
  }

  return { type: 'object' };
}

function zodFieldToJsonSchema(field: z.ZodTypeAny): import('../llm/types.js').JsonSchemaProperty {
  // Unwrap defaults and optionals
  let innerField = field;
  if (innerField instanceof z.ZodDefault) {
    innerField = innerField._def.innerType;
  }
  if (innerField instanceof z.ZodOptional) {
    innerField = innerField.unwrap();
  }

  const description = field.description;

  if (innerField instanceof z.ZodString) {
    return { type: 'string', description };
  }
  if (innerField instanceof z.ZodNumber) {
    return { type: 'number', description };
  }
  if (innerField instanceof z.ZodBoolean) {
    return { type: 'boolean', description };
  }
  if (innerField instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodFieldToJsonSchema(innerField.element),
      description,
    };
  }
  if (innerField instanceof z.ZodObject) {
    const objectSchema = zodToJsonSchema(innerField);
    return {
      type: 'object',
      properties: objectSchema.properties,
      required: objectSchema.required,
      description,
    };
  }
  if (innerField instanceof z.ZodEnum) {
    return {
      type: 'string',
      enum: innerField.options as string[],
      description,
    };
  }

  return { type: 'string', description };
}

// ============================================================================
// Pre-computed JSON Schemas for LLM
// ============================================================================

export const TOOL_JSON_SCHEMAS = {
  search_chunks: zodToJsonSchema(SearchChunksArgsSchema),
  get_excerpt: zodToJsonSchema(GetExcerptArgsSchema),
  graph_neighbors: zodToJsonSchema(GraphNeighborsArgsSchema),
  list_files: zodToJsonSchema(ListFilesArgsSchema),
  get_repo_summary: zodToJsonSchema(GetRepoSummaryArgsSchema),
} as const;
