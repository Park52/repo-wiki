# repo-wiki

Agentic AI CLI for repository Q&A and wiki generation.

[![npm version](https://badge.fury.io/js/repo-wiki.svg)](https://badge.fury.io/js/repo-wiki)
[![CI](https://github.com/user/repo-wiki/actions/workflows/ci.yml/badge.svg)](https://github.com/user/repo-wiki/actions/workflows/ci.yml)

## Installation

```bash
npm install -g repo-wiki
```

Or use with npx:

```bash
npx repo-wiki ask "How does authentication work?"
```

## Requirements

- Node.js >= 18.0.0
- OpenAI API key (set `OPENAI_API_KEY` environment variable)

## Quick Start

```bash
# Set your OpenAI API key
export OPENAI_API_KEY=sk-xxx

# Navigate to your repository
cd /path/to/your/repo

# Build the search index
repo-wiki index

# Ask questions about the codebase
repo-wiki ask "What is the main entry point?"

# Generate wiki documentation
repo-wiki wiki -o ./docs
```

## Commands

### `repo-wiki index`

Build or rebuild the repository index for fast code search.

```bash
repo-wiki index [options]

Options:
  -d, --dir <path>    Repository directory (default: current directory)
  -f, --force         Force rebuild even if index exists
```

### `repo-wiki ask`

Ask questions about the codebase using AI.

```bash
repo-wiki ask <question> [options]

Options:
  -d, --dir <path>      Repository directory (default: current directory)
  -o, --output <file>   Save answer to file
  -m, --model <model>   LLM model to use (default: gpt-4o)
  --verbose             Show detailed agent steps
```

### `repo-wiki wiki`

Generate comprehensive wiki documentation.

```bash
repo-wiki wiki [options]

Options:
  -d, --dir <path>      Repository directory (default: current directory)
  -o, --output <dir>    Output directory (default: ./wiki)
  -m, --model <model>   LLM model to use (default: gpt-4o)
```

## How It Works

RepoWiki uses an **Agentic AI** approach:

1. **Indexing**: Parses your codebase and builds a SQLite FTS5 index
2. **Agent Loop**: LLM receives your question and uses tools to explore the code
3. **Tool Calls**: The agent can search code, read files, explore imports/exports
4. **Verification**: All answers include verified source citations (file:line range)
5. **Retry Logic**: If sources are invalid, the agent automatically retries

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | Your OpenAI API key | Yes |
| `REPO_WIKI_MODEL` | Default model (overrides gpt-4o) | No |

## License

MIT
