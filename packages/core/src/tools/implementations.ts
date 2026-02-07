/**
 * Tool Implementations
 * Actual logic for each registered tool
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  ToolContext,
  ToolResult,
  ChunkSearchResult,
  ExcerptResult,
  GraphNeighbor,
  FileEntry,
  RepoSummary,
} from './types.js';
import type {
  SearchChunksArgs,
  GetExcerptArgs,
  GraphNeighborsArgs,
  ListFilesArgs,
  GetRepoSummaryArgs,
} from './schemas.js';

// ============================================================================
// search_chunks
// ============================================================================

export async function searchChunks(
  args: SearchChunksArgs,
  context: ToolContext
): Promise<ToolResult<ChunkSearchResult[]>> {
  try {
    const { query, topK = 10 } = args;
    
    // Use indexer if available, otherwise return empty
    const indexer = context.indexer as { search?: (q: string, k: number) => unknown[] } | undefined;
    
    if (!indexer?.search) {
      return {
        success: true,
        data: [],
        outputSummary: `No indexer available. Please run 'repo-wiki index' first.`,
      };
    }

    const results = indexer.search(query, topK) as ChunkSearchResult[];
    
    return {
      success: true,
      data: results,
      outputSummary: results.length > 0
        ? `Found ${results.length} chunks matching "${query}":\n${results.map((r, i) => 
            `[${i + 1}] ${r.path}:${r.startLine}-${r.endLine} (score: ${r.score.toFixed(3)})`
          ).join('\n')}`
        : `No chunks found for query: "${query}"`,
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      outputSummary: `Search failed: ${error instanceof Error ? error.message : String(error)}`,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// get_excerpt
// ============================================================================

export async function getExcerpt(
  args: GetExcerptArgs,
  context: ToolContext
): Promise<ToolResult<ExcerptResult>> {
  try {
    const { path: filePath, startLine, endLine } = args;
    const fullPath = path.join(context.repoPath, filePath);
    
    // Security: ensure path is within repo
    const resolvedPath = path.resolve(fullPath);
    if (!resolvedPath.startsWith(path.resolve(context.repoPath))) {
      return {
        success: false,
        data: { path: filePath, startLine, endLine, content: '', totalLines: 0 },
        outputSummary: `Access denied: path outside repository`,
        error: 'Path outside repository',
      };
    }

    if (!fs.existsSync(fullPath)) {
      return {
        success: false,
        data: { path: filePath, startLine, endLine, content: '', totalLines: 0 },
        outputSummary: `File not found: ${filePath}`,
        error: 'File not found',
      };
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');
    const totalLines = lines.length;

    // Validate line range
    const safeStart = Math.max(1, Math.min(startLine, totalLines));
    const safeEnd = Math.max(safeStart, Math.min(endLine, totalLines));
    
    const excerpt = lines.slice(safeStart - 1, safeEnd);
    const numberedContent = excerpt
      .map((line, i) => `${safeStart + i}: ${line}`)
      .join('\n');

    return {
      success: true,
      data: {
        path: filePath,
        startLine: safeStart,
        endLine: safeEnd,
        content: numberedContent,
        totalLines,
      },
      outputSummary: `File: ${filePath} (lines ${safeStart}-${safeEnd} of ${totalLines})\n\n${numberedContent}`,
    };
  } catch (error) {
    return {
      success: false,
      data: { path: args.path, startLine: args.startLine, endLine: args.endLine, content: '', totalLines: 0 },
      outputSummary: `Failed to read excerpt: ${error instanceof Error ? error.message : String(error)}`,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// graph_neighbors
// ============================================================================

export async function graphNeighbors(
  args: GraphNeighborsArgs,
  context: ToolContext
): Promise<ToolResult<GraphNeighbor[]>> {
  try {
    const { nodeId, depth = 1 } = args;
    
    // Graph functionality is a placeholder - would need code analysis
    // For now, return basic file-level relationships based on imports
    
    const neighbors: GraphNeighbor[] = [];
    
    // Try to parse the file for imports if nodeId is a file path
    const fullPath = path.join(context.repoPath, nodeId);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      
      // Simple import detection (TypeScript/JavaScript)
      const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
      let match;
      
      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1];
        if (importPath && !importPath.startsWith('.')) {
          // External package
          neighbors.push({
            node: { id: importPath, type: 'module', name: importPath },
            relation: 'imports',
            depth: 1,
          });
        } else if (importPath) {
          // Relative import
          const resolvedImport = path.resolve(path.dirname(fullPath), importPath);
          const relativePath = path.relative(context.repoPath, resolvedImport);
          neighbors.push({
            node: { id: relativePath, type: 'file', name: path.basename(relativePath) },
            relation: 'imports',
            depth: 1,
          });
        }
      }
    }

    return {
      success: true,
      data: neighbors,
      outputSummary: neighbors.length > 0
        ? `Found ${neighbors.length} neighbors for "${nodeId}" (depth: ${depth}):\n${neighbors.map(n => 
            `- ${n.relation} → ${n.node.name} (${n.node.type})`
          ).join('\n')}`
        : `No graph data available for: "${nodeId}"`,
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      outputSummary: `Graph query failed: ${error instanceof Error ? error.message : String(error)}`,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// list_files
// ============================================================================

export async function listFiles(
  args: ListFilesArgs,
  context: ToolContext
): Promise<ToolResult<FileEntry[]>> {
  try {
    const { glob: globPattern, limit = 100 } = args;
    
    // Simple glob matching (basic implementation)
    const files: FileEntry[] = [];
    
    function walkDir(dir: string, pattern: string): void {
      if (files.length >= limit) return;
      
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (files.length >= limit) break;
          
          // Skip hidden and common ignored directories
          if (entry.name.startsWith('.') || entry.name === 'node_modules') {
            continue;
          }
          
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(context.repoPath, fullPath);
          
          if (entry.isDirectory()) {
            walkDir(fullPath, pattern);
          } else if (entry.isFile()) {
            // Simple glob matching
            if (matchGlob(relativePath, pattern)) {
              const stats = fs.statSync(fullPath);
              files.push({
                path: relativePath,
                type: 'file',
                size: stats.size,
              });
            }
          }
        }
      } catch {
        // Ignore permission errors
      }
    }
    
    walkDir(context.repoPath, globPattern);
    
    return {
      success: true,
      data: files,
      outputSummary: files.length > 0
        ? `Found ${files.length} files matching "${globPattern}"${files.length >= limit ? ' (limit reached)' : ''}:\n${files.slice(0, 20).map(f => f.path).join('\n')}${files.length > 20 ? `\n... and ${files.length - 20} more` : ''}`
        : `No files found matching: "${globPattern}"`,
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      outputSummary: `Failed to list files: ${error instanceof Error ? error.message : String(error)}`,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Simple glob matcher (supports *, **, ?)
 */
function matchGlob(filepath: string, pattern: string): boolean {
  // Convert glob to regex
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(filepath);
}

// ============================================================================
// get_repo_summary
// ============================================================================

export async function getRepoSummary(
  _args: GetRepoSummaryArgs,
  context: ToolContext
): Promise<ToolResult<RepoSummary>> {
  try {
    let totalFiles = 0;
    let totalLines = 0;
    const languages: Record<string, number> = {};
    const directories = new Set<string>();

    const extToLang: Record<string, string> = {
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript',
      '.js': 'JavaScript',
      '.jsx': 'JavaScript',
      '.py': 'Python',
      '.rs': 'Rust',
      '.go': 'Go',
      '.java': 'Java',
      '.md': 'Markdown',
      '.json': 'JSON',
      '.yaml': 'YAML',
      '.yml': 'YAML',
    };

    function walkDir(dir: string): void {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules') {
            continue;
          }
          
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            const relativePath = path.relative(context.repoPath, fullPath);
            if (relativePath.split(path.sep).length === 1) {
              directories.add(relativePath);
            }
            walkDir(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            const lang = extToLang[ext];
            
            if (lang) {
              totalFiles++;
              languages[lang] = (languages[lang] ?? 0) + 1;
              
              try {
                const content = fs.readFileSync(fullPath, 'utf-8');
                totalLines += content.split('\n').length;
              } catch {
                // Skip unreadable files
              }
            }
          }
        }
      } catch {
        // Ignore permission errors
      }
    }
    
    walkDir(context.repoPath);
    
    // Get repo name from directory
    const repoName = path.basename(context.repoPath);
    
    // Try to read description from package.json or README
    let description: string | undefined;
    const packageJsonPath = path.join(context.repoPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        description = pkg.description;
      } catch {
        // Ignore
      }
    }

    const summary: RepoSummary = {
      name: repoName,
      totalFiles,
      totalLines,
      languages,
      topDirectories: Array.from(directories).slice(0, 10),
      description,
    };

    const langSummary = Object.entries(languages)
      .sort((a, b) => b[1] - a[1])
      .map(([lang, count]) => `${lang}: ${count} files`)
      .join(', ');

    return {
      success: true,
      data: summary,
      outputSummary: `Repository: ${repoName}
${description ? `Description: ${description}\n` : ''}
Stats: ${totalFiles} files, ${totalLines.toLocaleString()} lines
Languages: ${langSummary || 'None detected'}
Top directories: ${summary.topDirectories.join(', ') || 'None'}`,
    };
  } catch (error) {
    return {
      success: false,
      data: {
        name: path.basename(context.repoPath),
        totalFiles: 0,
        totalLines: 0,
        languages: {},
        topDirectories: [],
      },
      outputSummary: `Failed to generate summary: ${error instanceof Error ? error.message : String(error)}`,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
