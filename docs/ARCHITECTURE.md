# RepoWiki Architecture Guide

이 문서는 RepoWiki 프로젝트의 구조, 설계 의도, 확장 포인트를 설명합니다.  
새로운 기여자가 코드를 이해하고 어디를 수정해야 하는지 빠르게 파악할 수 있도록 작성되었습니다.

---

## 📋 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [설계 원칙](#설계-원칙)
3. [디렉토리 구조](#디렉토리-구조)
4. [핵심 모듈 설명](#핵심-모듈-설명)
5. [데이터 흐름](#데이터-흐름)
6. [확장 가이드](#확장-가이드)
7. [주요 타입 정의](#주요-타입-정의)

---

## 프로젝트 개요

### 목적
RepoWiki는 **Agentic AI CLI**입니다. LLM이 도구(tool)를 호출하여 코드베이스를 탐색하고, 질문에 답변하거나 위키 문서를 자동 생성합니다.

### 핵심 아이디어
```
User Question → LLM → Tool Calls → Code Analysis → Verified Answer
```

- **LLM은 "두뇌"**: 질문을 이해하고 어떤 도구를 사용할지 결정
- **Tools는 "손"**: 실제로 파일을 읽고, 검색하고, 분석
- **Verifier는 "검증관"**: 답변에 올바른 소스(파일+라인)가 포함되었는지 확인

---

## 설계 원칙

### 1. LLM은 Tool-Calling으로만 행동한다
LLM이 직접 코드를 생성하거나 실행하지 않습니다. 반드시 정의된 도구(tool)를 호출해야 합니다.

```typescript
// LLM 응답 예시
{
  "tool_calls": [
    { "name": "search_chunks", "arguments": { "query": "authentication" } },
    { "name": "get_excerpt", "arguments": { "path": "src/auth.ts", "startLine": 10, "endLine": 50 } }
  ]
}
```

### 2. 모든 답변은 Sources를 포함해야 한다
답변에는 반드시 근거(파일 경로 + 라인 범위)가 포함되어야 합니다. Verifier가 이를 검증합니다.

```markdown
## Sources
- `src/auth.ts`:10-50
- `src/utils/token.ts`:1-25
```

### 3. 제한된 Step과 발췌 길이
- **maxSteps: 8** - 무한 루프 방지
- **maxExcerptLines: 120** - 컨텍스트 오버플로우 방지
- **topK: 10** - 검색 결과 제한

### 4. Provider Agnostic
OpenAI 뿐만 아니라 Anthropic, Ollama, LM Studio 등 다양한 LLM을 지원합니다.

---

## 디렉토리 구조

```
repo-wiki/
├── packages/
│   ├── core/                    # 핵심 라이브러리 (npm: @repo-wiki/core)
│   │   └── src/
│   │       ├── agent/           # 🧠 Agent Loop 핵심 로직
│   │       │   ├── loop.ts      # runAgent() - 메인 에이전트 루프
│   │       │   ├── verifier.ts  # 소스 검증 로직
│   │       │   ├── prompt.ts    # 시스템 프롬프트 생성
│   │       │   └── tools.ts     # (레거시) 도구 실행
│   │       │
│   │       ├── llm/             # 🔌 LLM 프로바이더
│   │       │   ├── types.ts           # LlmProvider 인터페이스
│   │       │   ├── openai-provider.ts
│   │       │   ├── anthropic-provider.ts
│   │       │   ├── ollama-provider.ts
│   │       │   ├── openai-compatible-provider.ts
│   │       │   └── provider-factory.ts  # createProvider()
│   │       │
│   │       ├── tools/           # 🛠️ 도구 시스템
│   │       │   ├── types.ts     # ToolResult, ToolContext
│   │       │   ├── schemas.ts   # Zod 스키마 (입력 검증)
│   │       │   ├── implementations.ts  # 도구 구현체
│   │       │   └── registry.ts  # ToolRegistry 클래스
│   │       │
│   │       ├── indexer/         # 📚 SQLite FTS5 인덱서
│   │       │   └── index.ts     # Indexer 클래스
│   │       │
│   │       ├── types.ts         # 공통 타입 정의
│   │       └── index.ts         # Public exports
│   │
│   └── cli/                     # CLI 애플리케이션 (npm: repo-wiki)
│       └── src/
│           ├── commands/
│           │   ├── ask.ts       # repowiki ask
│           │   ├── wiki.ts      # repowiki wiki
│           │   └── index-cmd.ts # repowiki index
│           ├── utils.ts         # CLI 유틸리티
│           └── index.ts         # CLI 엔트리포인트
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml               # CI 파이프라인
│   │   └── publish.yml          # npm 배포
│   └── copilot-instructions.md  # AI 코딩 에이전트용 컨텍스트
│
├── docs/
│   └── ARCHITECTURE.md          # 이 문서
│
└── (root configs)
    ├── package.json             # Monorepo 설정 (npm workspaces)
    ├── tsconfig.json            # TypeScript 설정
    └── vitest.config.ts         # 테스트 설정
```

---

## 핵심 모듈 설명

### 1. Agent Loop (`packages/core/src/agent/loop.ts`)

**역할**: LLM과 대화하며 도구를 호출하고 최종 답변을 생성

```typescript
export async function runAgent(options: AgentLoopOptions): Promise<AgentLoopResult> {
  // 1. 시스템 프롬프트 생성
  // 2. LLM에 질문 전송
  // 3. Tool calls 처리 (loop)
  // 4. 답변 추출 및 검증
  // 5. 실패 시 재시도 (repair prompt)
}
```

**수정이 필요한 경우**:
- 에이전트 동작 방식 변경
- 재시도 로직 수정
- 출력 형식 변경

---

### 2. LLM Providers (`packages/core/src/llm/`)

**역할**: 다양한 LLM API와 통신

```
LlmProvider (interface)
    ├── OpenAIProvider       # OpenAI API
    ├── AnthropicProvider    # Claude API
    ├── OllamaProvider       # Ollama (로컬)
    └── OpenAICompatibleProvider  # LM Studio, Together, Groq 등
```

**수정이 필요한 경우**:
- 새 LLM 프로바이더 추가 → 새 파일 생성 후 `provider-factory.ts`에 등록
- API 변환 로직 수정

**새 프로바이더 추가 방법**:
```typescript
// 1. packages/core/src/llm/my-provider.ts 생성
export class MyProvider implements LlmProvider {
  readonly name = 'my-provider';
  readonly model: string;
  
  async chat(request: ChatRequest): Promise<ChatResponse> {
    // API 호출 구현
  }
}

// 2. provider-factory.ts에 등록
case 'my-provider':
  return new MyProvider(config);

// 3. index.ts에서 export
export { MyProvider } from './my-provider.js';
```

---

### 3. Tools System (`packages/core/src/tools/`)

**역할**: LLM이 사용할 수 있는 도구 정의 및 실행

**현재 도구 목록**:
| 도구명 | 역할 |
|--------|------|
| `search_chunks` | 코드 청크 검색 (FTS5) |
| `get_excerpt` | 파일 발췌 읽기 |
| `graph_neighbors` | import/export 관계 탐색 |
| `list_files` | glob 패턴으로 파일 목록 |
| `get_repo_summary` | 레포지토리 요약 |

**새 도구 추가 방법**:

```typescript
// 1. schemas.ts에 Zod 스키마 추가
export const MyToolArgsSchema = z.object({
  param1: z.string().describe('설명'),
  param2: z.number().optional(),
});
export type MyToolArgs = z.infer<typeof MyToolArgsSchema>;

// 2. implementations.ts에 구현 추가
export async function myTool(
  args: MyToolArgs,
  context: ToolContext
): Promise<ToolResult> {
  // 구현
  return {
    success: true,
    data: { ... },
    outputSummary: 'LLM이 읽을 요약',
  };
}

// 3. registry.ts의 TOOL_DEFINITIONS에 등록
{
  name: 'my_tool',
  description: 'LLM이 이 도구를 언제 사용해야 하는지 설명',
  schema: MyToolArgsSchema,
  handler: myTool,
}
```

---

### 4. Indexer (`packages/core/src/indexer/index.ts`)

**역할**: 레포지토리를 파싱하여 SQLite FTS5 인덱스 생성

**주요 기능**:
- 파일을 청크로 분할
- FTS5 전체 텍스트 검색
- import/export 그래프 구축

**수정이 필요한 경우**:
- 새 언어 파서 추가
- 청킹 전략 변경
- 검색 알고리즘 개선

---

### 5. Verifier (`packages/core/src/agent/verifier.ts`)

**역할**: 답변에 포함된 소스가 유효한지 검증

```typescript
export function verifySources(sources: Source[], config: AgentConfig): VerificationResult {
  // 1. 소스가 비어있으면 실패
  // 2. 파일이 존재하는지 확인
  // 3. 라인 범위가 유효한지 확인
  // 4. 레포지토리 외부 경로 차단
}
```

**수정이 필요한 경우**:
- 검증 규칙 추가/완화
- 에러 메시지 개선

---

### 6. CLI Commands (`packages/cli/src/commands/`)

**역할**: 사용자 인터페이스 제공

| 파일 | 명령어 | 역할 |
|------|--------|------|
| `ask.ts` | `repowiki ask` | 질문 답변 |
| `wiki.ts` | `repowiki wiki` | 위키 생성 |
| `index-cmd.ts` | `repowiki index` | 인덱스 구축 |

**수정이 필요한 경우**:
- CLI 옵션 추가
- 출력 형식 변경
- 새 명령어 추가

---

## 데이터 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER QUESTION                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CLI (ask.ts / wiki.ts)                     │
│  • Parse arguments                                              │
│  • Create LLM Provider (via provider-factory)                   │
│  • Call runAgent()                                              │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AGENT LOOP (loop.ts)                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 1. Generate System Prompt (prompt.ts)                     │  │
│  │ 2. Send to LLM Provider                                   │  │
│  │ 3. Parse Response                                         │  │
│  │    ├─ Tool Calls? → Execute via ToolRegistry → Loop       │  │
│  │    └─ Final Answer? → Extract & Verify                    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
┌─────────────────────────────┐ ┌─────────────────────────────────┐
│    LLM PROVIDER             │ │    TOOL REGISTRY                │
│    (openai, anthropic,      │ │    (registry.ts)                │
│     ollama, etc.)           │ │                                 │
│                             │ │    search_chunks ──┐            │
│    • Format request         │ │    get_excerpt ────┼─→ Indexer  │
│    • Call API               │ │    graph_neighbors ┘            │
│    • Parse response         │ │    list_files ──→ FileSystem    │
│                             │ │    get_repo_summary             │
└─────────────────────────────┘ └─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      VERIFIER (verifier.ts)                     │
│  • Check sources exist                                          │
│  • Validate line ranges                                         │
│  • Reject paths outside repo                                    │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      VERIFIED ANSWER                            │
│  • Markdown content                                             │
│  • Sources list                                                 │
│  • Execution steps                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 확장 가이드

### 🔌 새 LLM 프로바이더 추가
**위치**: `packages/core/src/llm/`

1. `{provider}-provider.ts` 파일 생성
2. `LlmProvider` 인터페이스 구현
3. `provider-factory.ts`에 case 추가
4. `index.ts`에서 export
5. CLI `utils.ts`의 `PROVIDER_ENV_KEYS`에 추가

### 🛠️ 새 도구 추가
**위치**: `packages/core/src/tools/`

1. `schemas.ts`에 Zod 스키마 추가
2. `implementations.ts`에 함수 구현
3. `registry.ts`의 `TOOL_DEFINITIONS`에 등록
4. `types.ts`의 `TOOL_NAMES`에 상수 추가

### 📝 새 위키 페이지 타입 추가
**위치**: `packages/cli/src/commands/wiki.ts`

`WIKI_PAGES` 객체에 새 페이지 타입 추가:
```typescript
WIKI_PAGES['api'] = {
  title: 'API Reference',
  prompt: `Generate API documentation...`,
};
```

### 🧪 새 테스트 추가
**위치**: `packages/core/src/__tests__/`

Vitest를 사용합니다:
```typescript
import { describe, it, expect } from 'vitest';

describe('MyFeature', () => {
  it('should work', () => {
    expect(true).toBe(true);
  });
});
```

---

## 주요 타입 정의

### AgentConfig
```typescript
interface AgentConfig {
  maxSteps: number;        // 최대 스텝 수 (기본: 8)
  maxExcerptLines: number; // 파일당 최대 발췌 라인 (기본: 120)
  topK: number;            // 검색 결과 수 (기본: 10)
  model: string;           // LLM 모델명
  repoPath: string;        // 레포지토리 경로
}
```

### LlmProvider
```typescript
interface LlmProvider {
  readonly name: string;   // 프로바이더 이름
  readonly model: string;  // 모델명
  chat(request: ChatRequest): Promise<ChatResponse>;
}
```

### ToolResult
```typescript
interface ToolResult<T = unknown> {
  success: boolean;
  data: T;
  outputSummary: string;  // LLM이 읽을 요약
  error?: string;
}
```

### Source
```typescript
interface Source {
  path: string;      // 파일 경로
  startLine: number; // 시작 라인 (1-based)
  endLine: number;   // 종료 라인 (inclusive)
}
```

---

## 자주 묻는 질문

### Q: 에이전트가 무한 루프에 빠지면?
A: `maxSteps` (기본: 8)에 도달하면 자동 종료됩니다.

### Q: 로컬 LLM을 사용하려면?
A: Ollama 또는 LM Studio를 설치하고 `--provider ollama` 옵션 사용

### Q: 새 언어 지원을 추가하려면?
A: `indexer/index.ts`의 파싱 로직 수정 필요

### Q: 테스트는 어떻게 실행하나요?
A: `npm test` 또는 `npm run test:watch`

---

## 관련 문서

- [README.md](../README.md) - 사용법
- [CONTRIBUTING.md](../CONTRIBUTING.md) - 기여 가이드
- [.github/copilot-instructions.md](../.github/copilot-instructions.md) - AI 코딩 에이전트용 컨텍스트
