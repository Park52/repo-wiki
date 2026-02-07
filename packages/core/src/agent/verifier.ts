/**
 * Source verifier for agent responses
 * Ensures all answers have valid sources
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Source, VerificationResult, AgentConfig } from '../types.js';

/**
 * Verify that sources are valid and exist
 */
export function verifySources(
  sources: Source[],
  config: AgentConfig
): VerificationResult {
  const errors: string[] = [];

  // Check that sources array is not empty
  if (!sources || sources.length === 0) {
    return {
      valid: false,
      errors: ['No sources provided. Every answer MUST include at least one source with path and line range.'],
    };
  }

  for (const source of sources) {
    // Validate source structure
    if (!source.path) {
      errors.push('Source missing path');
      continue;
    }

    if (typeof source.startLine !== 'number' || typeof source.endLine !== 'number') {
      errors.push(`Source ${source.path}: missing or invalid line numbers`);
      continue;
    }

    if (source.startLine < 1) {
      errors.push(`Source ${source.path}: startLine must be >= 1`);
      continue;
    }

    if (source.endLine < source.startLine) {
      errors.push(`Source ${source.path}: endLine must be >= startLine`);
      continue;
    }

    // Check file exists
    const fullPath = path.join(config.repoPath, source.path);
    const resolvedPath = path.resolve(fullPath);

    // Security check
    if (!resolvedPath.startsWith(path.resolve(config.repoPath))) {
      errors.push(`Source ${source.path}: path outside repository`);
      continue;
    }

    if (!fs.existsSync(fullPath)) {
      errors.push(`Source ${source.path}: file does not exist`);
      continue;
    }

    // Check line range validity
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const lineCount = content.split('\n').length;

      if (source.startLine > lineCount) {
        errors.push(`Source ${source.path}: startLine ${source.startLine} exceeds file length ${lineCount}`);
      }

      if (source.endLine > lineCount) {
        errors.push(`Source ${source.path}: endLine ${source.endLine} exceeds file length ${lineCount}`);
      }
    } catch {
      errors.push(`Source ${source.path}: failed to read file`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Format sources for display
 */
export function formatSources(sources: Source[]): string {
  if (sources.length === 0) {
    return 'No sources';
  }

  return sources
    .map((s) => `- ${s.path}:${s.startLine}-${s.endLine}`)
    .join('\n');
}

/**
 * Create verification error message for LLM retry
 */
export function createVerificationErrorPrompt(result: VerificationResult): string {
  return `Your answer failed source verification. You MUST provide valid sources.

Errors:
${result.errors.map((e) => `- ${e}`).join('\n')}

Please try again with a valid answer that includes:
1. An answer to the question
2. A sources array with at least one entry containing:
   - path: relative file path that exists in the repository
   - startLine: starting line number (>= 1)
   - endLine: ending line number (>= startLine)

Use the search_index or read_file tools to find relevant code first.`;
}

/**
 * Parse sources from markdown answer text
 * Expects format: - `path/to/file`:10-25
 */
export function parseSourcesFromMarkdown(answerMd: string): Source[] {
  const sources: Source[] = [];
  
  // Find Sources section
  const sourcesMatch = answerMd.match(/##\s*Sources\s*\n([\s\S]*?)(?:\n##|$)/i);
  if (!sourcesMatch) {
    return sources;
  }

  const sourcesSection = sourcesMatch[1] ?? '';
  
  // Parse source entries
  const sourcePattern = /[-*]\s*`([^`]+)`\s*:\s*(\d+)\s*-\s*(\d+)/g;
  let match;

  while ((match = sourcePattern.exec(sourcesSection)) !== null) {
    const [, filePath, startStr, endStr] = match;
    
    if (!filePath || !startStr || !endStr) continue;

    const startLine = parseInt(startStr, 10);
    const endLine = parseInt(endStr, 10);

    if (!isNaN(startLine) && !isNaN(endLine)) {
      sources.push({ path: filePath, startLine, endLine });
    }
  }

  return sources;
}

/**
 * Verify sources extracted from markdown answer
 */
export function verifyMarkdownSources(
  answerMd: string,
  repoPath: string
): VerificationResult {
  const sources = parseSourcesFromMarkdown(answerMd);
  
  if (sources.length === 0) {
    return {
      valid: false,
      errors: ['No valid sources found in answer. Format: - `path/to/file`:startLine-endLine'],
    };
  }

  // Use existing verifySources with a minimal config
  return verifySources(sources, {
    repoPath,
    maxSteps: 8,
    maxExcerptLines: 120,
    topK: 10,
    model: '',
  });
}
