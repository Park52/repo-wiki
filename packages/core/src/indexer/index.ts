/**
 * SQLite-based repository indexer
 * Stores file contents and provides search functionality
 */

import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IndexedFile, SearchResult } from '../types.js';

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  '.next',
  '.nuxt',
  'coverage',
  '__pycache__',
  '.venv',
  'venv',
]);

const INDEXED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.py',
  '.rs',
  '.go',
  '.java',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.md',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
]);

export interface IndexerConfig {
  repoPath: string;
  dbPath?: string;
}

export class Indexer {
  private db: Database.Database;
  private repoPath: string;

  constructor(config: IndexerConfig) {
    this.repoPath = path.resolve(config.repoPath);
    const dbPath = config.dbPath ?? path.join(this.repoPath, '.repo-wiki', 'index.db');

    // Ensure directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT UNIQUE NOT NULL,
        content TEXT NOT NULL,
        last_modified INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
      
      CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
        path,
        content,
        content='files',
        content_rowid='id'
      );

      CREATE TRIGGER IF NOT EXISTS files_ai AFTER INSERT ON files BEGIN
        INSERT INTO files_fts(rowid, path, content) VALUES (new.id, new.path, new.content);
      END;

      CREATE TRIGGER IF NOT EXISTS files_ad AFTER DELETE ON files BEGIN
        INSERT INTO files_fts(files_fts, rowid, path, content) VALUES('delete', old.id, old.path, old.content);
      END;

      CREATE TRIGGER IF NOT EXISTS files_au AFTER UPDATE ON files BEGIN
        INSERT INTO files_fts(files_fts, rowid, path, content) VALUES('delete', old.id, old.path, old.content);
        INSERT INTO files_fts(rowid, path, content) VALUES (new.id, new.path, new.content);
      END;
    `);
  }

  /**
   * Index all files in the repository
   */
  async indexRepository(): Promise<{ indexed: number; skipped: number }> {
    let indexed = 0;
    let skipped = 0;

    const files = this.walkDirectory(this.repoPath);

    const insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO files (path, content, last_modified)
      VALUES (?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      for (const filePath of files) {
        try {
          const relativePath = path.relative(this.repoPath, filePath);
          const stats = fs.statSync(filePath);
          const content = fs.readFileSync(filePath, 'utf-8');

          insertStmt.run(relativePath, content, stats.mtimeMs);
          indexed++;
        } catch {
          skipped++;
        }
      }
    });

    transaction();

    return { indexed, skipped };
  }

  private walkDirectory(dir: string): string[] {
    const files: string[] = [];

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          files.push(...this.walkDirectory(fullPath));
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (INDEXED_EXTENSIONS.has(ext)) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }

  /**
   * Search indexed files using FTS5
   */
  search(query: string, topK: number = 10): SearchResult[] {
    // Escape special FTS5 characters and create search query
    const sanitizedQuery = query
      .replace(/['"]/g, '')
      .split(/\s+/)
      .filter((term) => term.length > 0)
      .map((term) => `"${term}"`)
      .join(' OR ');

    if (!sanitizedQuery) {
      return [];
    }

    const stmt = this.db.prepare(`
      SELECT 
        f.path,
        f.content,
        bm25(files_fts) as score
      FROM files_fts fts
      JOIN files f ON fts.rowid = f.id
      WHERE files_fts MATCH ?
      ORDER BY score
      LIMIT ?
    `);

    const results = stmt.all(sanitizedQuery, topK) as Array<{
      path: string;
      content: string;
      score: number;
    }>;

    return results.map((row) => {
      const lines = row.content.split('\n');
      const matchIndex = this.findBestMatchLine(lines, query);
      const startLine = Math.max(1, matchIndex - 5);
      const endLine = Math.min(lines.length, matchIndex + 15);

      return {
        path: row.path,
        score: Math.abs(row.score),
        snippet: lines.slice(startLine - 1, endLine).join('\n'),
        startLine,
        endLine,
      };
    });
  }

  private findBestMatchLine(lines: string[], query: string): number {
    const queryTerms = query.toLowerCase().split(/\s+/);
    let bestLine = 1;
    let bestScore = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.toLowerCase() ?? '';
      let score = 0;
      for (const term of queryTerms) {
        if (line.includes(term)) {
          score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestLine = i + 1;
      }
    }

    return bestLine;
  }

  /**
   * Read file content from index
   */
  readFile(filePath: string): IndexedFile | null {
    const stmt = this.db.prepare(`
      SELECT id, path, content, last_modified as lastModified
      FROM files
      WHERE path = ?
    `);

    const result = stmt.get(filePath) as IndexedFile | undefined;
    return result ?? null;
  }

  /**
   * List files matching a pattern
   */
  listFiles(directory: string, pattern?: string): string[] {
    let query = `SELECT path FROM files WHERE path LIKE ?`;
    const params: string[] = [`${directory}%`];

    if (pattern) {
      // Convert glob to SQL LIKE pattern
      const sqlPattern = pattern.replace(/\*/g, '%').replace(/\?/g, '_');
      query += ` AND path LIKE ?`;
      params.push(`%${sqlPattern}`);
    }

    const stmt = this.db.prepare(query);
    const results = stmt.all(...params) as Array<{ path: string }>;

    return results.map((r) => r.path);
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }
}
