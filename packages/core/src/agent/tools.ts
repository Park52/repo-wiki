/**
 * Tool implementations for the agent
 * Each tool executes an action and returns a result
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  ToolName,
  SearchIndexArgs,
  ReadFileArgs,
  ListFilesArgs,
  FinalAnswerArgs,
  AgentConfig,
  Source,
} from '../types.js';
import { Indexer } from '../indexer/index.js';

export interface ToolContext {
  config: AgentConfig;
  indexer: Indexer;
}

export interface ToolExecutionResult {
  content: string;
  isError: boolean;
  isFinalAnswer: boolean;
  answer?: string;
  sources?: Source[];
}

/**
 * Execute a tool by name with given arguments
 */
export function executeTool(
  toolName: ToolName,
  args: Record<string, unknown>,
  context: ToolContext
): ToolExecutionResult {
  switch (toolName) {
    case 'search_index':
      return executeSearchIndex(args as unknown as SearchIndexArgs, context);
    case 'read_file':
      return executeReadFile(args as unknown as ReadFileArgs, context);
    case 'list_files':
      return executeListFiles(args as unknown as ListFilesArgs, context);
    case 'final_answer':
      return executeFinalAnswer(args as unknown as FinalAnswerArgs);
    default:
      return {
        content: `Unknown tool: ${toolName}`,
        isError: true,
        isFinalAnswer: false,
      };
  }
}

function executeSearchIndex(
  args: SearchIndexArgs,
  context: ToolContext
): ToolExecutionResult {
  try {
    const topK = args.topK ?? context.config.topK;
    const results = context.indexer.search(args.query, topK);

    if (results.length === 0) {
      return {
        content: `No results found for query: "${args.query}"`,
        isError: false,
        isFinalAnswer: false,
      };
    }

    const formattedResults = results.map((r, i) => {
      // Truncate snippet to maxExcerptLines
      const lines = r.snippet.split('\n');
      const truncatedSnippet =
        lines.length > context.config.maxExcerptLines
          ? lines.slice(0, context.config.maxExcerptLines).join('\n') + '\n... (truncated)'
          : r.snippet;

      return `[${i + 1}] ${r.path}:${r.startLine}-${r.endLine} (score: ${r.score.toFixed(3)})\n${truncatedSnippet}`;
    });

    return {
      content: `Found ${results.length} results:\n\n${formattedResults.join('\n\n---\n\n')}`,
      isError: false,
      isFinalAnswer: false,
    };
  } catch (error) {
    return {
      content: `Search failed: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
      isFinalAnswer: false,
    };
  }
}

function executeReadFile(
  args: ReadFileArgs,
  context: ToolContext
): ToolExecutionResult {
  try {
    const fullPath = path.join(context.config.repoPath, args.path);

    // Security check: ensure path is within repo
    const resolvedPath = path.resolve(fullPath);
    if (!resolvedPath.startsWith(path.resolve(context.config.repoPath))) {
      return {
        content: `Access denied: path outside repository`,
        isError: true,
        isFinalAnswer: false,
      };
    }

    if (!fs.existsSync(fullPath)) {
      return {
        content: `File not found: ${args.path}`,
        isError: true,
        isFinalAnswer: false,
      };
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');

    const startLine = args.startLine ?? 1;
    const endLine = args.endLine ?? lines.length;

    // Enforce max excerpt lines
    const maxEnd = Math.min(endLine, startLine + context.config.maxExcerptLines - 1);
    const selectedLines = lines.slice(startLine - 1, maxEnd);

    const header = `File: ${args.path} (lines ${startLine}-${maxEnd} of ${lines.length})`;
    const numberedContent = selectedLines
      .map((line, i) => `${startLine + i}: ${line}`)
      .join('\n');

    return {
      content: `${header}\n\n${numberedContent}`,
      isError: false,
      isFinalAnswer: false,
    };
  } catch (error) {
    return {
      content: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
      isFinalAnswer: false,
    };
  }
}

function executeListFiles(
  args: ListFilesArgs,
  context: ToolContext
): ToolExecutionResult {
  try {
    const files = context.indexer.listFiles(args.directory, args.pattern);

    if (files.length === 0) {
      return {
        content: `No files found in: ${args.directory}${args.pattern ? ` matching ${args.pattern}` : ''}`,
        isError: false,
        isFinalAnswer: false,
      };
    }

    return {
      content: `Found ${files.length} files:\n${files.join('\n')}`,
      isError: false,
      isFinalAnswer: false,
    };
  } catch (error) {
    return {
      content: `Failed to list files: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
      isFinalAnswer: false,
    };
  }
}

function executeFinalAnswer(args: FinalAnswerArgs): ToolExecutionResult {
  return {
    content: args.answer,
    isError: false,
    isFinalAnswer: true,
    answer: args.answer,
    sources: args.sources,
  };
}
