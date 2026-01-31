#!/bin/bash
# Test RepoWiki with Ollama
# Ollama를 사용하여 RepoWiki의 주요 기능을 테스트합니다.

set -e

echo "🧪 RepoWiki + Ollama Test Suite"
echo "================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
MODEL="${OLLAMA_MODEL:-llama3.1}"
TEST_DIR="${TEST_DIR:-./test-output}"
REPO_PATH="$(pwd)"

# Check if Ollama is available
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
  echo -e "${RED}✗ Ollama server is not running${NC}"
  echo ""
  echo "Please run setup first:"
  echo "  ./scripts/setup-ollama.sh"
  exit 1
fi

# Check if model exists
if ! ollama list | grep -q "^$MODEL"; then
  echo -e "${YELLOW}Model '$MODEL' not found. Downloading...${NC}"
  ollama pull "$MODEL"
fi

echo -e "${GREEN}✓ Ollama is ready${NC}"
echo -e "${BLUE}Model: $MODEL${NC}"
echo -e "${BLUE}Test output: $TEST_DIR${NC}"
echo ""

# Create test output directory
mkdir -p "$TEST_DIR"

# Build the project
echo -e "${YELLOW}Building RepoWiki...${NC}"
npm run build > /dev/null 2>&1
echo -e "${GREEN}✓ Build complete${NC}"
echo ""

# Define CLI command
CLI="node packages/cli/dist/index.js"

# Test 1: Index repository
echo -e "${YELLOW}[Test 1/5] Indexing repository...${NC}"
$CLI index -r "$REPO_PATH" > "$TEST_DIR/test1-index.log" 2>&1
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Indexing successful${NC}"
else
  echo -e "${RED}✗ Indexing failed${NC}"
  cat "$TEST_DIR/test1-index.log"
  exit 1
fi
echo ""

# Test 2: Simple question
echo -e "${YELLOW}[Test 2/5] Testing simple question...${NC}"
echo "Question: \"What is this project?\""
$CLI ask \
  --provider ollama \
  --model "$MODEL" \
  --repo "$REPO_PATH" \
  --out "$TEST_DIR/test2-answer.md" \
  --steps "$TEST_DIR/test2-steps.json" \
  "What is this project?" > "$TEST_DIR/test2-output.log" 2>&1

if [ $? -eq 0 ] && [ -f "$TEST_DIR/test2-answer.md" ]; then
  echo -e "${GREEN}✓ Question answered${NC}"
  echo ""
  echo "--- Answer Preview ---"
  head -n 10 "$TEST_DIR/test2-answer.md"
  echo "..."
  echo "----------------------"
else
  echo -e "${RED}✗ Failed to answer question${NC}"
  cat "$TEST_DIR/test2-output.log"
  exit 1
fi
echo ""

# Test 3: Technical question
echo -e "${YELLOW}[Test 3/5] Testing technical question...${NC}"
echo "Question: \"Explain the agent loop implementation\""
$CLI ask \
  --provider ollama \
  --model "$MODEL" \
  --repo "$REPO_PATH" \
  --out "$TEST_DIR/test3-answer.md" \
  "Explain the agent loop implementation" > "$TEST_DIR/test3-output.log" 2>&1

if [ $? -eq 0 ] && [ -f "$TEST_DIR/test3-answer.md" ]; then
  echo -e "${GREEN}✓ Technical question answered${NC}"
  
  # Check if sources are included
  if grep -q "## Sources" "$TEST_DIR/test3-answer.md"; then
    echo -e "${GREEN}✓ Sources are included${NC}"
  else
    echo -e "${YELLOW}⚠ Sources may be missing${NC}"
  fi
else
  echo -e "${RED}✗ Failed to answer technical question${NC}"
  cat "$TEST_DIR/test3-output.log"
  exit 1
fi
echo ""

# Test 4: Wiki generation - Overview page
echo -e "${YELLOW}[Test 4/5] Testing wiki generation (overview)...${NC}"
$CLI wiki \
  --provider ollama \
  --model "$MODEL" \
  --repo "$REPO_PATH" \
  --page overview \
  --out "$TEST_DIR/wiki" > "$TEST_DIR/test4-output.log" 2>&1

if [ $? -eq 0 ] && [ -f "$TEST_DIR/wiki/overview.md" ]; then
  echo -e "${GREEN}✓ Wiki overview generated${NC}"
  echo ""
  echo "--- Wiki Preview ---"
  head -n 15 "$TEST_DIR/wiki/overview.md"
  echo "..."
  echo "--------------------"
else
  echo -e "${RED}✗ Failed to generate wiki${NC}"
  cat "$TEST_DIR/test4-output.log"
  exit 1
fi
echo ""

# Test 5: Verbose mode
echo -e "${YELLOW}[Test 5/5] Testing verbose mode...${NC}"
$CLI ask \
  --provider ollama \
  --model "$MODEL" \
  --repo "$REPO_PATH" \
  --verbose \
  "List 3 main modules" > "$TEST_DIR/test5-verbose.log" 2>&1

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ Verbose mode works${NC}"
  
  # Check if step logs are present
  if grep -q "Step" "$TEST_DIR/test5-verbose.log"; then
    echo -e "${GREEN}✓ Step logs are present${NC}"
  else
    echo -e "${YELLOW}⚠ Step logs may be missing${NC}"
  fi
else
  echo -e "${RED}✗ Verbose mode failed${NC}"
  cat "$TEST_DIR/test5-verbose.log"
  exit 1
fi
echo ""

# Performance summary
echo -e "${BLUE}═══════════════════════════════════${NC}"
echo -e "${BLUE}Performance Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════${NC}"

for i in {2..5}; do
  LOG="$TEST_DIR/test${i}-output.log"
  if [ -f "$LOG" ]; then
    TIME=$(grep -o "Total time: [^,]*" "$LOG" | head -1 || echo "N/A")
    STEPS=$(grep -o "Steps: [0-9]*" "$LOG" | head -1 || echo "N/A")
    echo "Test $i: $TIME, $STEPS"
  fi
done
echo ""

# Final summary
echo -e "${GREEN}═══════════════════════════════════${NC}"
echo -e "${GREEN}✓ All Tests Passed!${NC}"
echo -e "${GREEN}═══════════════════════════════════${NC}"
echo ""
echo "Test outputs saved to: $TEST_DIR"
echo ""
echo "Generated files:"
ls -lh "$TEST_DIR"/*.md 2>/dev/null || echo "  (no markdown files)"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  • Review test outputs: ls $TEST_DIR"
echo "  • Try your own questions: repowiki ask --provider ollama \"your question\""
echo "  • Generate full wiki: repowiki wiki --provider ollama --all"
