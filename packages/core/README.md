# @repo-wiki/core

Core library for RepoWiki - an Agentic AI system for repository Q&A and wiki generation.

## Installation

```bash
npm install @repo-wiki/core
```

## Features

- **Agent Loop**: LLM-driven agent that uses tool-calls (JSON actions) to explore codebases
- **SQLite FTS5 Indexer**: Full-text search indexing for code chunks
- **LLM Providers**: OpenAI integration with extensible provider interface
- **Tool Registry**: Modular tool system (search, file reading, graph navigation)
- **Source Verification**: Ensures all answers include valid source citations

## Usage

```typescript
import { runAgent, createIndexer, OpenAIProvider, createToolRegistry } from '@repo-wiki/core';

// Create LLM provider
const llmProvider = new OpenAIProvider('gpt-4o', process.env.OPENAI_API_KEY);

// Create indexer and tool registry
const indexer = await createIndexer('/path/to/repo');
const tools = createToolRegistry('/path/to/repo', indexer);

// Run agent
const result = await runAgent({
  question: 'How does the authentication system work?',
  llmProvider,
  tools,
  config: {
    repoPath: '/path/to/repo',
    maxSteps: 8,
    maxExcerptLines: 120,
    topK: 10,
    model: 'gpt-4o',
  },
});

console.log(result.answer);
console.log(result.sources);
```

## API Reference

### `runAgent(options)`

Main agent loop that processes questions about codebases.

**Options:**
- `question`: The question to answer
- `llmProvider`: LLM provider instance
- `tools`: Tool registry instance
- `config`: Agent configuration

**Returns:** `AgentResult` with `answer`, `sources`, `steps`, and `verified` fields

### `createIndexer(repoPath)`

Creates SQLite FTS5 indexer for code search.

### `createToolRegistry(repoPath, indexer?)`

Creates tool registry with built-in tools:
- `search_chunks`: Search indexed code chunks
- `get_excerpt`: Read file excerpts (max 120 lines)
- `graph_neighbors`: Find import/export relationships
- `list_files`: List files matching glob patterns
- `get_repo_summary`: Get repository overview

## License

MIT
