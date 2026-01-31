/**
 * Source Verifier Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  verifySources,
  formatSources,
  parseSourcesFromMarkdown,
  verifyMarkdownSources,
} from '../agent/verifier.js';
import type { Source, AgentConfig } from '../types.js';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';

describe('verifySources', () => {
  let testDir: string;
  let config: AgentConfig;

  beforeEach(() => {
    // Create a temporary test directory
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-wiki-verifier-'));
    
    // Create test file with 10 lines
    fs.writeFileSync(
      path.join(testDir, 'test.ts'),
      Array.from({ length: 10 }, (_, i) => `// Line ${i + 1}`).join('\n')
    );
    
    config = {
      repoPath: testDir,
      maxSteps: 8,
      maxExcerptLines: 120,
      topK: 10,
      model: 'gpt-4o',
    };
  });

  it('should validate valid sources', () => {
    const sources: Source[] = [
      { path: 'test.ts', startLine: 1, endLine: 5 },
    ];

    const result = verifySources(sources, config);
    
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject empty sources', () => {
    const result = verifySources([], config);
    
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('No sources');
  });

  it('should reject missing path', () => {
    const sources = [{ path: '', startLine: 1, endLine: 5 }] as Source[];

    const result = verifySources(sources, config);
    
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('missing path');
  });

  it('should reject non-existent file', () => {
    const sources: Source[] = [
      { path: 'nonexistent.ts', startLine: 1, endLine: 5 },
    ];

    const result = verifySources(sources, config);
    
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('does not exist');
  });

  it('should reject invalid line range', () => {
    const sources: Source[] = [
      { path: 'test.ts', startLine: 5, endLine: 1 }, // end < start
    ];

    const result = verifySources(sources, config);
    
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('endLine must be >= startLine');
  });

  it('should reject startLine < 1', () => {
    const sources: Source[] = [
      { path: 'test.ts', startLine: 0, endLine: 5 },
    ];

    const result = verifySources(sources, config);
    
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('startLine must be >= 1');
  });

  it('should reject line range exceeding file length', () => {
    const sources: Source[] = [
      { path: 'test.ts', startLine: 1, endLine: 100 }, // File only has 10 lines
    ];

    const result = verifySources(sources, config);
    
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('exceeds file length');
  });

  it('should reject path outside repository', () => {
    const sources: Source[] = [
      { path: '../../../etc/passwd', startLine: 1, endLine: 5 },
    ];

    const result = verifySources(sources, config);
    
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('outside repository');
  });
});

describe('formatSources', () => {
  it('should format sources as list', () => {
    const sources: Source[] = [
      { path: 'src/index.ts', startLine: 10, endLine: 25 },
      { path: 'src/utils.ts', startLine: 1, endLine: 15 },
    ];

    const formatted = formatSources(sources);
    
    expect(formatted).toContain('src/index.ts:10-25');
    expect(formatted).toContain('src/utils.ts:1-15');
  });

  it('should return "No sources" for empty array', () => {
    const formatted = formatSources([]);
    
    expect(formatted).toBe('No sources');
  });
});

describe('parseSourcesFromMarkdown', () => {
  it('should parse sources section', () => {
    const markdown = `
# Answer

Some content here.

## Sources
- \`src/index.ts\`:10-25
- \`src/utils.ts\`:1-15
`;

    const sources = parseSourcesFromMarkdown(markdown);
    
    expect(sources).toHaveLength(2);
    expect(sources[0]).toEqual({ path: 'src/index.ts', startLine: 10, endLine: 25 });
    expect(sources[1]).toEqual({ path: 'src/utils.ts', startLine: 1, endLine: 15 });
  });

  it('should return empty array if no Sources section', () => {
    const markdown = `
# Answer

No sources here.
`;

    const sources = parseSourcesFromMarkdown(markdown);
    
    expect(sources).toHaveLength(0);
  });

  it('should handle asterisk bullet points', () => {
    const markdown = `
## Sources
* \`file.ts\`:1-10
`;

    const sources = parseSourcesFromMarkdown(markdown);
    
    expect(sources).toHaveLength(1);
    expect(sources[0]).toEqual({ path: 'file.ts', startLine: 1, endLine: 10 });
  });

  it('should ignore invalid source formats', () => {
    const markdown = `
## Sources
- Invalid format
- \`file.ts\`:10-20
- Also invalid
`;

    const sources = parseSourcesFromMarkdown(markdown);
    
    expect(sources).toHaveLength(1);
    expect(sources[0]?.path).toBe('file.ts');
  });
});

describe('verifyMarkdownSources', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-wiki-md-'));
    fs.writeFileSync(
      path.join(testDir, 'src', 'index.ts').replace('/src/', '/'),
      '// content'
    );
  });

  it('should reject markdown without Sources section', () => {
    const markdown = `# Answer\n\nNo sources.`;

    const result = verifyMarkdownSources(markdown, testDir);
    
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('No valid sources');
  });
});
