/**
 * Agent Loop Types
 * Type definitions for the agent execution loop
 */

import type { Source } from '../types.js';
import type { LlmProvider, ToolCallResult } from '../llm/types.js';

// ============================================================================
// Agent Configuration
// ============================================================================

export interface AgentLoopConfig {
  /** Repository root path */
  repoRoot: string;
  /** Path to SQLite index database */
  dbPath?: string;
  /** The question to answer */
  question: string;
  /** LLM provider instance */
  llmProvider: LlmProvider;
  /** Maximum steps before forced termination (default: 8) */
  maxSteps?: number;
  /** Maximum lines per tool output excerpt (default: 120) */
  maxExcerptLines?: number;
  /** Maximum characters for tool output in context (default: 8000) */
  maxToolOutputChars?: number;
  /** Enable verbose logging */
  verbose?: boolean;
}

export const DEFAULT_AGENT_LOOP_CONFIG = {
  maxSteps: 8,
  maxExcerptLines: 120,
  maxToolOutputChars: 8000,
  verbose: false,
} as const;

// ============================================================================
// Step Logging
// ============================================================================

export interface StepLog {
  /** Step number (1-indexed) */
  stepNo: number;
  /** Tool name if a tool was called */
  toolName?: string;
  /** Tool input arguments (JSON string) */
  toolInput?: string;
  /** Summary of tool output */
  toolOutputSummary?: string;
  /** Time taken for this step in milliseconds */
  elapsedMs: number;
  /** Summary of LLM message/response */
  modelMessageSummary: string;
  /** Whether this step resulted in DONE */
  isDone: boolean;
  /** Whether verifier passed (only for DONE steps) */
  verifierPassed?: boolean;
  /** Verifier errors if any */
  verifierErrors?: string[];
}

// ============================================================================
// Agent Result
// ============================================================================

export interface AgentLoopResult {
  /** Final answer in Markdown format */
  answerMd: string;
  /** All steps executed */
  steps: StepLog[];
  /** Verified sources from the answer */
  sources: Source[];
  /** Whether the answer passed verification */
  verified: boolean;
  /** Total execution time in milliseconds */
  totalMs: number;
  /** Error message if terminated due to error */
  error?: string;
}

// ============================================================================
// LLM Response Parsing
// ============================================================================

export interface ParsedLLMResponse {
  /** Type of response */
  type: 'tool_calls' | 'done' | 'error';
  /** Tool calls if type is 'tool_calls' */
  toolCalls?: ToolCallResult[];
  /** Final answer markdown if type is 'done' */
  answerMd?: string;
  /** Raw text content from LLM */
  rawContent?: string;
  /** Error message if type is 'error' */
  error?: string;
}

// ============================================================================
// Verifier Types
// ============================================================================

export interface SourceVerificationResult {
  /** Whether all sources are valid */
  valid: boolean;
  /** Parsed sources from answer */
  sources: Source[];
  /** Verification errors */
  errors: string[];
}

// ============================================================================
// Context Message Types (for internal use)
// ============================================================================

export interface ContextMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCallResult[];
}
