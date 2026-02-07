/**
 * Tool Schemas Tests
 */

import { describe, it, expect } from 'vitest';
import {
  SearchChunksArgsSchema,
  GetExcerptArgsSchema,
  GraphNeighborsArgsSchema,
  ListFilesArgsSchema,
  GetRepoSummaryArgsSchema,
  zodToJsonSchema,
} from '../tools/schemas.js';

describe('SearchChunksArgsSchema', () => {
  it('should validate valid input', () => {
    const result = SearchChunksArgsSchema.safeParse({
      query: 'agent loop',
      topK: 5,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query).toBe('agent loop');
      expect(result.data.topK).toBe(5);
    }
  });

  it('should use default topK', () => {
    const result = SearchChunksArgsSchema.safeParse({
      query: 'test query',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.topK).toBe(10);
    }
  });

  it('should reject empty query', () => {
    const result = SearchChunksArgsSchema.safeParse({
      query: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject topK out of range', () => {
    const result = SearchChunksArgsSchema.safeParse({
      query: 'test',
      topK: 100,
    });
    expect(result.success).toBe(false);
  });
});

describe('GetExcerptArgsSchema', () => {
  it('should validate valid input', () => {
    const result = GetExcerptArgsSchema.safeParse({
      path: 'src/index.ts',
      startLine: 1,
      endLine: 50,
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing path', () => {
    const result = GetExcerptArgsSchema.safeParse({
      startLine: 1,
      endLine: 50,
    });
    expect(result.success).toBe(false);
  });

  it('should reject negative line numbers', () => {
    const result = GetExcerptArgsSchema.safeParse({
      path: 'src/index.ts',
      startLine: -1,
      endLine: 50,
    });
    expect(result.success).toBe(false);
  });
});

describe('GraphNeighborsArgsSchema', () => {
  it('should validate valid input', () => {
    const result = GraphNeighborsArgsSchema.safeParse({
      nodeId: 'src/index.ts',
      depth: 2,
    });
    expect(result.success).toBe(true);
  });

  it('should use default depth', () => {
    const result = GraphNeighborsArgsSchema.safeParse({
      nodeId: 'src/index.ts',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.depth).toBe(1);
    }
  });

  it('should reject depth > 5', () => {
    const result = GraphNeighborsArgsSchema.safeParse({
      nodeId: 'src/index.ts',
      depth: 10,
    });
    expect(result.success).toBe(false);
  });
});

describe('ListFilesArgsSchema', () => {
  it('should validate valid input', () => {
    const result = ListFilesArgsSchema.safeParse({
      glob: '**/*.ts',
      limit: 50,
    });
    expect(result.success).toBe(true);
  });

  it('should use default limit', () => {
    const result = ListFilesArgsSchema.safeParse({
      glob: '**/*.ts',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(100);
    }
  });
});

describe('GetRepoSummaryArgsSchema', () => {
  it('should validate empty object', () => {
    const result = GetRepoSummaryArgsSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('zodToJsonSchema', () => {
  it('should convert SearchChunksArgsSchema to JSON Schema', () => {
    const jsonSchema = zodToJsonSchema(SearchChunksArgsSchema);
    
    expect(jsonSchema.type).toBe('object');
    expect(jsonSchema.properties).toBeDefined();
    expect(jsonSchema.properties?.['query']).toBeDefined();
    expect(jsonSchema.properties?.['query']?.type).toBe('string');
    expect(jsonSchema.required).toContain('query');
  });

  it('should convert GetExcerptArgsSchema to JSON Schema', () => {
    const jsonSchema = zodToJsonSchema(GetExcerptArgsSchema);
    
    expect(jsonSchema.type).toBe('object');
    expect(jsonSchema.required).toContain('path');
    expect(jsonSchema.required).toContain('startLine');
    expect(jsonSchema.required).toContain('endLine');
  });
});
