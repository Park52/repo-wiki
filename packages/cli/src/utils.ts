/**
 * CLI Utilities
 * Shared utilities for CLI commands
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';
import type { ProviderType } from '@repo-wiki/core';

/**
 * Provider to environment variable mapping
 */
const PROVIDER_ENV_KEYS: Record<string, string | undefined> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  together: 'TOGETHER_API_KEY',
  groq: 'GROQ_API_KEY',
  ollama: undefined,  // No API key needed
  lmstudio: undefined,  // No API key needed
  'openai-compatible': undefined,  // Optional
};

/**
 * Check if OPENAI_API_KEY is set (legacy function)
 */
export function checkApiKey(): void {
  checkApiKeyForProvider('openai');
}

/**
 * Check if required API key is set for a provider
 * Local providers (ollama, lmstudio) don't need API keys
 */
export function checkApiKeyForProvider(provider: ProviderType): void {
  const envKey = PROVIDER_ENV_KEYS[provider];
  
  // No API key needed for local providers
  if (!envKey) {
    return;
  }
  
  if (!process.env[envKey]) {
    console.error(chalk.red(`Error: ${envKey} environment variable is not set.`));
    console.error('');
    console.error(`To use the ${provider} provider, you need an API key.`);
    console.error('');
    console.error('Set it with:');
    console.error(chalk.cyan(`  export ${envKey}=your-api-key`));
    console.error('');
    console.error('Or use a local provider that doesn\'t require an API key:');
    console.error(chalk.cyan('  repowiki ask --provider ollama "your question"'));
    console.error(chalk.cyan('  repowiki ask --provider lmstudio "your question"'));
    process.exit(1);
  }
}

/**
 * Check if index exists for the repository
 */
export function checkIndexExists(repoPath: string): boolean {
  const dbPath = path.join(repoPath, '.repo-wiki', 'index.db');
  return fs.existsSync(dbPath);
}

/**
 * Get the default database path for a repository
 */
export function getDbPath(repoPath: string): string {
  return path.join(repoPath, '.repo-wiki', 'index.db');
}

/**
 * Ensure a directory exists, creating it if necessary
 */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Write content to a file, creating parent directories if needed
 */
export function writeFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Format a step log for display
 */
export function formatStepLog(step: {
  stepNo: number;
  toolName?: string;
  elapsedMs: number;
  isDone: boolean;
  verifierPassed?: boolean;
}): string {
  const status = step.isDone
    ? step.verifierPassed
      ? chalk.green('✓ DONE')
      : chalk.yellow('⚠ DONE (unverified)')
    : step.toolName
      ? chalk.blue(`→ ${step.toolName}`)
      : chalk.gray('...');
  
  return `  ${chalk.gray(`[${step.stepNo}]`)} ${status} ${chalk.gray(`(${step.elapsedMs}ms)`)}`;
}

/**
 * Format elapsed time in human-readable format
 */
export function formatTime(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}

/**
 * Print a boxed header
 */
export function printHeader(text: string): void {
  const line = '─'.repeat(text.length + 4);
  console.log(chalk.cyan(`┌${line}┐`));
  console.log(chalk.cyan(`│  ${text}  │`));
  console.log(chalk.cyan(`└${line}┘`));
}
