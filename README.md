# RepoWiki

**Agentic AI CLI for repository Q&A and wiki generation**

RepoWiki는 LLM 기반 에이전트를 사용하여 코드베이스를 분석하고 질문에 답변하며, 자동으로 위키 문서를 생성하는 도구입니다.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 🤖 **Agentic AI**: LLM이 tool-calling을 통해 자율적으로 코드 탐색
- 🔍 **Code Search**: SQLite FTS5 기반 전체 텍스트 검색
- 📚 **Auto Wiki**: 레포지토리 구조를 분석하여 위키 페이지 자동 생성
- 🎯 **Source Verification**: 모든 답변에 근거(파일 경로 + 라인 번호) 포함
- 🛠️ **Extensible Tools**: 검색, 파일 읽기, 그래프 탐색 등 다양한 도구
- 🔌 **Multi-Provider**: OpenAI, Anthropic, Ollama, LM Studio, Together, Groq 등 지원

---

## 📦 Installation

```bash
# Clone repository
git clone https://github.com/Park52/repo-wiki.git
cd repo-wiki

# Install dependencies
npm install

# Build packages
npm run build

# Link CLI globally (optional)
npm link --workspace=@repo-wiki/cli
```

---

## 🚀 Quick Start

### 1. Set API Key (for cloud providers)

```bash
# OpenAI
export OPENAI_API_KEY=sk-...

# Or Anthropic
export ANTHROPIC_API_KEY=sk-ant-...

# Or Together AI
export TOGETHER_API_KEY=...

# Or Groq
export GROQ_API_KEY=...
```

### 2. Ask Questions

```bash
# Ask about your codebase (default: OpenAI gpt-4o)
repowiki ask "What is the main architecture of this project?"

# Use Claude
repowiki ask --provider anthropic "Explain the agent loop"

# Use local Ollama (no API key needed!)
repowiki ask --provider ollama --model llama3.1 "What tools are available?"

# Use LM Studio (local)
repowiki ask --provider lmstudio --base-url http://localhost:1234/v1 "Summarize this project"

# Save answer and steps
repowiki ask "How does the agent loop work?" \
  --out answer.md \
  --steps steps.json \
  --verbose
```

### 3. Generate Wiki

```bash
# Generate specific wiki page
repowiki wiki --page overview --out ./wiki

# Generate all wiki pages
repowiki wiki --all --out ./wiki

# Available page types:
# - overview: Project overview and purpose
# - build: Build & setup instructions
# - architecture: Architecture and components
# - modules: Module descriptions
```

---

## 📖 Commands

### `repowiki ask`

레포지토리에 대한 질문에 답변합니다.

```bash
repowiki ask "<question>" [options]
```

**Options:**
- `-r, --repo <path>` - Repository path (default: current directory)
- `-p, --provider <name>` - LLM provider: openai, anthropic, ollama, lmstudio, together, groq (default: openai)
- `-m, --model <model>` - LLM model (auto-selected per provider if omitted)
- `-u, --base-url <url>` - Base URL for local/custom providers
- `-s, --max-steps <n>` - Maximum agent steps (default: 8)
- `-o, --out <path>` - Save answer markdown to file
- `--steps <path>` - Save execution steps to JSON
- `-v, --verbose` - Show detailed step logs

**Examples:**
```bash
# Basic question (OpenAI)
repowiki ask "Explain the AgentLoop implementation"

# Use Claude (Anthropic)
repowiki ask --provider anthropic "Explain the codebase structure"

# Use local Ollama
repowiki ask --provider ollama --model mistral "What does this project do?"

# Use Groq (fast inference)
repowiki ask --provider groq --model llama-3.1-70b-versatile "Summarize the architecture"

# Save outputs
repowiki ask "What tools are available?" --out answer.md --steps debug.json

# Custom model and steps
repowiki ask "How does indexing work?" --model gpt-4-turbo --max-steps 10
```

### `repowiki wiki`

위키 문서를 생성합니다.

```bash
repowiki wiki [options]
```

**Options:**
- `-r, --repo <path>` - Repository path (default: current directory)
- `-p, --provider <name>` - LLM provider: openai, anthropic, ollama, lmstudio, together, groq (default: openai)
- `-m, --model <model>` - LLM model (auto-selected per provider if omitted)
- `-u, --base-url <url>` - Base URL for local/custom providers
- `--page <type>` - Page type: overview|build|architecture|modules
- `-a, --all` - Generate all wiki pages
- `-o, --out <dir>` - Output directory (default: ./wiki)
- `-v, --verbose` - Show detailed progress

**Examples:**
```bash
# Single page (OpenAI)
repowiki wiki --page overview

# All pages with Claude
repowiki wiki --all --provider anthropic --out ./docs/wiki

# Using local Ollama
repowiki wiki --provider ollama --model llama3.1 --all

# Custom output
repowiki wiki --page architecture --out ./architecture.md
```

### `repowiki index`

레포지토리 인덱스를 생성합니다.

```bash
repowiki index [options]
```

**Options:**
- `-r, --repo <path>` - Repository path

**Note:** `ask`와 `wiki` 명령어는 인덱스가 없으면 자동으로 생성합니다.

---

## 🏗️ Architecture

```
repo-wiki/
├── packages/
│   ├── core/              # Core library
│   │   ├── agent/         # AgentLoop, verifier
│   │   ├── llm/           # LLM providers (OpenAI, Local)
│   │   ├── tools/         # Tool registry & implementations
│   │   └── indexer/       # SQLite FTS5 indexer
│   └── cli/               # CLI commands
│       ├── commands/      # ask, wiki, index
│       └── utils.ts       # Shared utilities
```

### Agent Loop Flow

```
1. User Question
   ↓
2. System Prompt + Tools → LLM
   ↓
3. LLM Response:
   ├─ Tool Calls → Execute → Add to Context → Loop to 2
   └─ DONE + Answer → Verify Sources → Return
```

### Available Tools

| Tool | Description |
|------|-------------|
| `search_chunks` | Search indexed code chunks (FTS5) |
| `get_excerpt` | Read file excerpt by line range |
| `graph_neighbors` | Find related code (imports/exports) |
| `list_files` | List files matching glob pattern |
| `get_repo_summary` | Get repository overview |

---

## 🔧 Configuration

### Supported Providers

| Provider | Type | API Key Env Var | Default Model |
|----------|------|-----------------|---------------|
| `openai` | Cloud | `OPENAI_API_KEY` | gpt-4o |
| `anthropic` | Cloud | `ANTHROPIC_API_KEY` | claude-3-5-sonnet-latest |
| `together` | Cloud | `TOGETHER_API_KEY` | meta-llama/Llama-3-70b-chat-hf |
| `groq` | Cloud | `GROQ_API_KEY` | llama-3.1-70b-versatile |
| `ollama` | Local | (none) | llama3.1 |
| `lmstudio` | Local | (none) | local-model |

### Environment Variables

```bash
# Cloud Providers (pick one)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
TOGETHER_API_KEY=...
GROQ_API_KEY=...

# Optional
OPENAI_BASE_URL=https://api.openai.com/v1  # Custom endpoint
```

### Local LLM Setup

#### Ollama (Recommended for local)
```bash
# Install Ollama: https://ollama.ai
ollama pull llama3.1
ollama serve  # Start server

# Use with RepoWiki
repowiki ask --provider ollama "What is this project?"
```

#### LM Studio
```bash
# Download LM Studio: https://lmstudio.ai
# Load a model and start the local server (port 1234)

# Use with RepoWiki
repowiki ask --provider lmstudio --base-url http://localhost:1234/v1 "Describe the architecture"
```

### Custom LLM Providers

```typescript
import { runAgent, LlmProvider } from '@repo-wiki/core';

class MyProvider implements LlmProvider {
  // Implement chat() method
}

const result = await runAgent({
  repoRoot: '/path/to/repo',
  question: 'How does X work?',
  llmProvider: new MyProvider(),
});
```

## 🧪 로컬 LLM으로 테스트하기

### 자동화된 Ollama 테스트

RepoWiki를 Ollama로 검증하는 3개의 테스트 스크립트가 포함되어 있습니다:

```bash
# 1. 최초 설정 + 종합 테스트 (처음 실행 시)
./scripts/setup-ollama.sh && ./scripts/test-with-ollama.sh

# 2. 빠른 스모크 테스트 (Ollama 이미 설치된 경우)
./scripts/quick-test.sh

# 3. 전체 테스트 스위트 (5개 테스트: 인덱스, 질문, 위키, verbose, 성능)
./scripts/test-with-ollama.sh
```

**각 스크립트 설명:**
- `setup-ollama.sh`: Ollama 설치 (macOS/Linux), llama3.1 다운로드, 서버 시작
- `test-with-ollama.sh`: 모든 주요 기능을 커버하는 종합 테스트 실행
- `quick-test.sh`: 빠른 검증을 위한 스모크 테스트

---

## 📊 Output Format

### Answer Markdown

```markdown
The AgentLoop orchestrates LLM interactions by...

## Sources
- `packages/core/src/agent/loop.ts`:15-45
- `packages/core/src/types.ts`:10-25
```

### Steps JSON

```json
{
  "question": "How does the agent loop work?",
  "totalMs": 3542,
  "verified": true,
  "steps": [
    {
      "stepNo": 1,
      "toolName": "search_chunks",
      "elapsedMs": 234,
      "isDone": false
    }
  ],
  "sources": [...]
}
```

---

## 🛠️ Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Watch mode
npm run dev

# Type check
npm run typecheck

# Clean build artifacts
npm run clean
```

### Package Structure

- `@repo-wiki/core` - Core library (agent, LLM, tools, indexer)
- `@repo-wiki/cli` - CLI application

---

## 📝 How It Works

### 1. Indexing
SQLite FTS5를 사용하여 모든 파일을 인덱스화합니다:
```typescript
const indexer = new Indexer({ repoPath: '/path/to/repo' });
await indexer.indexRepository();
```

### 2. Agent Loop
LLM이 tool-calling을 통해 자율적으로 코드를 탐색:
1. LLM에게 질문 + 사용 가능한 tools 제공
2. LLM이 tool call 또는 최종 답변 반환
3. Tool 실행 결과를 컨텍스트에 추가
4. 최대 8 step까지 반복
5. Sources 검증 후 답변 반환

### 3. Source Verification
모든 답변은 반드시 Sources 섹션을 포함해야 하며:
- Format: `` `path/to/file.ts`:startLine-endLine ``
- 파일 존재 여부 및 라인 범위 검증
- 검증 실패 시 LLM에게 재시도 요청

---

## ⚠️ Current Limitations

- **LLM Provider**: OpenAI만 완전 지원 (LocalProvider는 stub)
- **Graph Analysis**: Import/export 분석이 기본적 수준
- **Language Support**: 주요 언어만 인덱싱 (.ts, .js, .py, .rs, .go, .java 등)
- **Max Steps**: 최대 8 step 제한 (복잡한 질문은 답변 불가능할 수 있음)

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

Built with:
- [OpenAI](https://openai.com/) - LLM API
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - SQLite with FTS5
- [Commander.js](https://github.com/tj/commander.js) - CLI framework
- [Zod](https://github.com/colinhacks/zod) - Schema validation

---

**Status**: ✅ **Production Ready** - Core features implemented and tested