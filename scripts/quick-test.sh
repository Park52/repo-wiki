#!/bin/bash
# Quick test with Ollama
# 간단하게 Ollama가 작동하는지 빠르게 테스트합니다.

set -e

MODEL="${OLLAMA_MODEL:-llama3.1}"
CLI="node packages/cli/dist/index.js"

echo "🚀 Quick Ollama Test"
echo "===================="
echo ""

# Check Ollama
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
  echo "❌ Ollama is not running"
  echo "Run: ./scripts/setup-ollama.sh"
  exit 1
fi

# Build
echo "Building..."
npm run build --silent 2>&1 | grep -v "npm WARN" || true

echo ""
echo "Testing with Ollama ($MODEL)..."
echo ""

# Simple test
$CLI ask \
  --provider ollama \
  --model "$MODEL" \
  "What is the main purpose of this project? Answer in 2-3 sentences."

echo ""
echo "✅ Test complete!"
