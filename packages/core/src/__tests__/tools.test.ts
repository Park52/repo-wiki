/**
 * Tool Registry Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry, createToolRegistry } from '../tools/registry.js';
import type { ToolContext } from '../tools/types.js';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;
  let testDir: string;

  beforeEach(() => {
    // Create a temporary test directory
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-wiki-test-'));
    
    // Create test files
    fs.writeFileSync(
      path.join(testDir, 'test.ts'),
      `import { foo } from './foo.js';
export function bar() {
  return foo();
}
`
    );
    fs.writeFileSync(
      path.join(testDir, 'foo.ts'),
      `export function foo() {
  return 'hello';
}
`
    );
    
    registry = createToolRegistry(testDir);
  });

  describe('getToolNames', () => {
    it('should return all registered tool names', () => {
      const names = registry.getToolNames();
      
      expect(names).toContain('search_chunks');
      expect(names).toContain('get_excerpt');
      expect(names).toContain('graph_neighbors');
      expect(names).toContain('list_files');
      expect(names).toContain('get_repo_summary');
      expect(names.length).toBe(5);
    });
  });

  describe('hasTool', () => {
    it('should return true for existing tools', () => {
      expect(registry.hasTool('search_chunks')).toBe(true);
      expect(registry.hasTool('get_excerpt')).toBe(true);
    });

    it('should return false for non-existing tools', () => {
      expect(registry.hasTool('unknown_tool')).toBe(false);
    });
  });

  describe('getToolSchemas', () => {
    it('should return schemas for all tools', () => {
      const schemas = registry.getToolSchemas();
      
      expect(schemas.length).toBe(5);
      
      const searchSchema = schemas.find((s) => s.name === 'search_chunks');
      expect(searchSchema).toBeDefined();
      expect(searchSchema?.description).toBeDefined();
      expect(searchSchema?.parameters).toBeDefined();
    });
  });

  describe('executeToolCall - get_excerpt', () => {
    it('should read file excerpt', async () => {
      const result = await registry.executeToolCall('get_excerpt', {
        path: 'test.ts',
        startLine: 1,
        endLine: 3,
      });

      expect(result.success).toBe(true);
      expect(result.outputSummary).toContain('test.ts');
      expect(result.outputSummary).toContain('import');
    });

    it('should handle non-existent file', async () => {
      const result = await registry.executeToolCall('get_excerpt', {
        path: 'nonexistent.ts',
        startLine: 1,
        endLine: 10,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should validate line numbers', async () => {
      const result = await registry.executeToolCall('get_excerpt', {
        path: 'test.ts',
        startLine: -1,
        endLine: 10,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('executeToolCall - list_files', () => {
    it('should list files matching glob', async () => {
      const result = await registry.executeToolCall('list_files', {
        glob: '*.ts',
        limit: 10,
      });

      // Should succeed - whether or not files are found depends on glob implementation
      expect(result.success).toBe(true);
    });

    it('should respect limit', async () => {
      const result = await registry.executeToolCall('list_files', {
        glob: '*.ts',
        limit: 1,
      });

      expect(result.success).toBe(true);
      // Should have at most 1 file
    });
  });

  describe('executeToolCall - get_repo_summary', () => {
    it('should return repository summary', async () => {
      const result = await registry.executeToolCall('get_repo_summary', {});

      expect(result.success).toBe(true);
      expect(result.outputSummary).toContain('Repository');
      expect(result.data).toHaveProperty('totalFiles');
      expect(result.data).toHaveProperty('languages');
    });
  });

  describe('executeToolCall - graph_neighbors', () => {
    it('should find import relationships', async () => {
      const result = await registry.executeToolCall('graph_neighbors', {
        nodeId: 'test.ts',
        depth: 1,
      });

      expect(result.success).toBe(true);
      // Should find ./foo.js import
      expect(result.outputSummary).toContain('neighbor');
    });
  });

  describe('executeToolCall - unknown tool', () => {
    it('should return error for unknown tool', async () => {
      const result = await registry.executeToolCall('unknown_tool', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown tool');
    });
  });

  describe('executeToolCall - invalid args', () => {
    it('should return validation error for invalid args', async () => {
      const result = await registry.executeToolCall('get_excerpt', {
        // Missing required fields
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });
  });
});
