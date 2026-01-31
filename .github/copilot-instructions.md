# Copilot Instructions for RepoWiki

## Project Overview

RepoWiki is an **Agentic AI CLI** that answers questions about codebases and generates wiki documentation. It uses an LLM-driven agent loop where the LLM issues tool-calls (JSON actions) and code executes them.

**Stack**: Node.js + TypeScript (ESM), npm workspaces, SQLite (FTS5) for indexing

## Architecture

```
packages/
├── core/     # Agent loop, LLM client, tools, indexer
└── cli/      # Commander-based CLI commands
```

### Agent Loop Pattern (`packages/core/src/agent/index.ts`)
1. LLM receives system prompt + user question
2. LLM responds with tool-calls (JSON) via function calling
3. Code executes tools and returns results to LLM
4. Loop continues until `final_answer` tool or max steps (8)
5. Verifier checks sources; retries automatically on failure

### Core Constraints
- **maxSteps**: 8 (prevents infinite loops)
- **maxExcerptLines**: 120 per file read
- **topK**: 10 search results default
- **Sources required**: Every answer MUST include `sources: [{path, startLine, endLine}]`

## Key Files

| Purpose | File |
|---------|------|
| Agent orchestration | `packages/core/src/agent/index.ts` |
| Tool definitions | `packages/core/src/agent/tools.ts` |
| Source verification | `packages/core/src/agent/verifier.ts` |
| LLM function schemas | `packages/core/src/llm/index.ts` |
| SQLite FTS5 indexer | `packages/core/src/indexer/index.ts` |
| Type definitions | `packages/core/src/types.ts` |

## Commands

```bash
# Setup
npm install
npm run build

# CLI usage
npx repo-wiki index              # Build repository index
npx repo-wiki ask "question"     # Ask about the codebase  
npx repo-wiki wiki -o ./docs     # Generate wiki documentation
```

## Conventions

- **ESM only**: Use `.js` extensions in imports (e.g., `./types.js`)
- **Tool pattern**: Tools return `ToolExecutionResult` with `{content, isError, isFinalAnswer}`
- **Verification**: `verifySources()` validates paths exist and line ranges are valid
- **Error handling**: Tools catch errors and return `isError: true` instead of throwing

## Environment Variables

- `OPENAI_API_KEY`: Required for LLM access
