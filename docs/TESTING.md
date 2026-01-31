# 테스트 가이드

## Ollama (로컬 LLM)로 테스트하기

### 빠른 시작

```bash
# 최초 설정
./scripts/setup-ollama.sh
./scripts/test-with-ollama.sh

# 이후 테스트 (Ollama가 이미 실행 중인 경우)
./scripts/quick-test.sh
```

---

## 테스트 스크립트 개요

### 1. `setup-ollama.sh` - 자동 환경 설정

**목적**: Ollama와 llama3.1 모델 설치 및 설정

**수행 작업:**
- OS 감지 (macOS/Linux)
- Ollama 미설치 시 자동 설치 (Homebrew 또는 curl)
- Ollama 서버 시작
- llama3.1:8b 모델 다운로드
- 서버 연결 확인
- 사용 가능한 모델 목록 출력

**사용법:**
```bash
./scripts/setup-ollama.sh
```

**플랫폼 지원:**
- macOS: Homebrew 사용 (`brew install ollama`)
- Linux: ollama.ai에서 다운로드

**예상 시간:** 5-10분 (모델 다운로드 포함)

---

### 2. `test-with-ollama.sh` - 종합 테스트 스위트

**목적**: Ollama로 RepoWiki의 모든 기능 검증

**테스트 범위:**

#### 테스트 1: 저장소 인덱싱
- repo-wiki 코드베이스 인덱싱
- SQLite 데이터베이스 생성 확인
- 청킹 및 임베딩 검증

#### 테스트 2: 기본 질문
- 질문: "What is this project about?"
- 에이전트 루프 실행 검증
- 소스 인용 확인

#### 테스트 3: 기술적 심화 질문
- 질문: "How does the agent loop work?"
- 코드 검색 및 요약 테스트
- 다단계 추론 검증

#### 테스트 4: Wiki 생성
- 위키 문서 생성
- 마크다운 출력 품질 테스트
- 배치 처리 검증

#### 테스트 5: Verbose 모드
- `--verbose` 플래그로 실행
- 단계별 출력 테스트
- JSON 형식 검증

**사용법:**
```bash
./scripts/test-with-ollama.sh
```

**출력:**
- 성공: ✅ Test [N]: [설명]
- 실패: ❌ Test [N]: [설명]
- 성능: 총 실행 시간 및 테스트별 시간

**예상 시간:** 3-5분

---

### 3. `quick-test.sh` - 빠른 스모크 테스트

**목적**: Ollama + RepoWiki 동작 빠른 검증

**수행 작업:**
- 단일 질문: "What is this project?"
- 최소 출력
- 빠른 실행

**사용법:**
```bash
./scripts/quick-test.sh
```

**예상 시간:** 10-30초

---

## 지속적 통합 (CI)

### GitHub Actions 예시

```yaml
name: Ollama 테스트

on: [push, pull_request]

jobs:
  test-ollama:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Node.js 설정
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: 의존성 설치
        run: npm install
      
      - name: 빌드
        run: npm run build
      
      - name: Ollama 설정
        run: ./scripts/setup-ollama.sh
      
      - name: 테스트 실행
        run: ./scripts/test-with-ollama.sh
```

---

## 수동 테스트 워크플로우

### 1. 초기 설정
```bash
# 프로젝트 빌드
npm install
npm run build

# Ollama 설정
./scripts/setup-ollama.sh
```

### 2. 개별 명령어 테스트

#### 저장소 인덱싱
```bash
npx repo-wiki index
```

#### 질문하기
```bash
npx repo-wiki ask --provider ollama "이 코드베이스는 무엇을 하나요?"
npx repo-wiki ask --provider ollama "인덱서는 어떻게 구현되어 있나요?"
```

#### Wiki 생성
```bash
npx repo-wiki wiki --provider ollama -o ./docs
```

### 3. 출력 검증

**답변 형식:**
- 답변 마크다운 포함 필수
- "## Sources" 섹션 필수
- 소스는 실제 파일과 라인 번호 참조

**Wiki 형식:**
- 출력 디렉토리에 여러 마크다운 파일
- 목차 (index.md)
- 모듈 문서
- 아키텍처 개요

---

## 문제 해결

### Ollama 서버 응답 없음
```bash
# Ollama 실행 확인
curl http://localhost:11434/api/tags

# Ollama 재시작
ollama serve &
```

### 모델을 찾을 수 없음
```bash
# 사용 가능한 모델 목록
ollama list

# llama3.1 다운로드
ollama pull llama3.1
```

### 성능 문제
- Llama3.1:8b는 약 8GB RAM 필요
- 더 빠른 테스트를 위해 작은 모델 사용: `ollama pull llama3.1:3b`
- 더 빠른 (덜 정밀한) 답변을 위해 에이전트 설정의 `maxSteps` 조정

### 빌드 오류
```bash
# 클린 빌드
rm -rf packages/*/dist
npm run build
```

---

## 테스트 모범 사례

### 코드 커밋 전

1. **빠른 테스트** 실행하여 기본 기능 확인:
   ```bash
   ./scripts/quick-test.sh
   ```

2. **전체 테스트 스위트** 실행하여 종합 검증:
   ```bash
   ./scripts/test-with-ollama.sh
   ```

3. **출력 품질 확인:**
   - 소스가 올바르게 인용되었는가?
   - 라인 번호가 실제 코드와 일치하는가?
   - 답변이 관련성 있고 정확한가?

### 새 LLM 프로바이더 테스트

새 프로바이더 (예: `GeminiProvider`) 추가 시:

1. `LlmProvider` 인터페이스 구현
2. 프로바이더 팩토리에 추가
3. `test-with-ollama.sh`와 유사한 테스트 스크립트 생성
4. 모든 핵심 기능 테스트 (index, ask, wiki)
5. README.md에 문서화

---

## 성능 벤치마크

M1 Mac에서 llama3.1:8b 기준 일반적인 성능:

| 작업 | 시간 | 비고 |
|------|------|------|
| 저장소 인덱싱 | 30-60초 | 저장소당 1회 |
| 간단한 질문 | 10-20초 | 2-3 에이전트 단계 |
| 복잡한 질문 | 30-60초 | 5-8 에이전트 단계 |
| Wiki 생성 | 2-5분 | 여러 질문 처리 |

성능은 다음에 따라 달라짐:
- 모델 크기 (3b vs 8b vs 70b)
- 하드웨어 (CPU vs GPU)
- 질문 복잡도
- 저장소 크기

---

## 디버깅 도구

### Verbose 출력 활성화
```bash
npx repo-wiki ask --provider ollama --verbose "질문"
```

### 에이전트 단계 확인
```bash
npx repo-wiki ask --provider ollama --output steps.json "질문"
cat steps.json | jq '.steps'
```

### 소스 검증 테스트
```bash
# verbose 출력에서 검증 경고 확인
npx repo-wiki ask --provider ollama --verbose "질문" 2>&1 | grep "verif"
```

### Ollama 로그 모니터링
```bash
# 별도 터미널에서
ollama serve
```

---

## 향후 테스트 개선 사항

- [ ] Ollama 프로바이더 유닛 테스트 추가
- [ ] 스트리밍 응답 테스트
- [ ] 다양한 모델 벤치마크 (llama3.1, mistral, codellama)
- [ ] 모든 프로바이더 통합 테스트 추가
- [ ] 성능 회귀 테스트 생성
- [ ] 대형 저장소 (>1GB) 테스트 추가
