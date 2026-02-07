#!/bin/bash
# Ollama Setup Script
# Ollama를 설치하고 필요한 모델을 다운로드합니다.

set -e

echo "🚀 RepoWiki Ollama Setup"
echo "========================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default model
MODEL="${OLLAMA_MODEL:-llama3.1}"

# Check OS
OS="$(uname -s)"
case "$OS" in
  Linux*)  PLATFORM="Linux";;
  Darwin*) PLATFORM="macOS";;
  *)       PLATFORM="UNKNOWN";;
esac

echo -e "${BLUE}Platform: $PLATFORM${NC}"
echo ""

# 1. Check if Ollama is installed
echo -e "${YELLOW}[1/4] Checking Ollama installation...${NC}"
if command -v ollama &> /dev/null; then
  OLLAMA_VERSION=$(ollama --version 2>&1 | head -n 1)
  echo -e "${GREEN}✓ Ollama is already installed: $OLLAMA_VERSION${NC}"
else
  echo -e "${YELLOW}Ollama not found. Installing...${NC}"
  
  if [ "$PLATFORM" = "macOS" ]; then
    # macOS installation
    if command -v brew &> /dev/null; then
      echo "Installing via Homebrew..."
      brew install ollama
    else
      echo "Downloading Ollama installer..."
      curl -fsSL https://ollama.ai/install.sh | sh
    fi
  elif [ "$PLATFORM" = "Linux" ]; then
    # Linux installation
    echo "Installing via install script..."
    curl -fsSL https://ollama.ai/install.sh | sh
  else
    echo -e "${RED}✗ Unsupported platform: $PLATFORM${NC}"
    echo "Please install Ollama manually: https://ollama.ai"
    exit 1
  fi
  
  echo -e "${GREEN}✓ Ollama installed${NC}"
fi
echo ""

# 2. Start Ollama server (if not running)
echo -e "${YELLOW}[2/4] Starting Ollama server...${NC}"
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Ollama server is already running${NC}"
else
  echo "Starting Ollama server in background..."
  
  if [ "$PLATFORM" = "macOS" ]; then
    # macOS: Use brew services or background process
    if brew services list | grep -q ollama; then
      brew services start ollama
    else
      ollama serve > /tmp/ollama.log 2>&1 &
      OLLAMA_PID=$!
      echo "Ollama PID: $OLLAMA_PID"
    fi
  else
    # Linux: Background process
    ollama serve > /tmp/ollama.log 2>&1 &
    OLLAMA_PID=$!
    echo "Ollama PID: $OLLAMA_PID"
  fi
  
  # Wait for server to be ready
  echo "Waiting for Ollama server to start..."
  for i in {1..30}; do
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
      echo -e "${GREEN}✓ Ollama server is ready${NC}"
      break
    fi
    sleep 1
    echo -n "."
  done
  echo ""
fi
echo ""

# 3. Check if model exists
echo -e "${YELLOW}[3/4] Checking model: $MODEL${NC}"
if ollama list | grep -q "^$MODEL"; then
  echo -e "${GREEN}✓ Model '$MODEL' is already downloaded${NC}"
else
  echo -e "${YELLOW}Downloading model '$MODEL'...${NC}"
  echo "This may take a few minutes (3-8 GB download)"
  echo ""
  
  ollama pull "$MODEL"
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Model '$MODEL' downloaded successfully${NC}"
  else
    echo -e "${RED}✗ Failed to download model${NC}"
    exit 1
  fi
fi
echo ""

# 4. Test connection
echo -e "${YELLOW}[4/4] Testing Ollama connection...${NC}"
TEST_RESPONSE=$(curl -s http://localhost:11434/api/generate -d "{
  \"model\": \"$MODEL\",
  \"prompt\": \"Say 'Hello' in one word.\",
  \"stream\": false
}" | grep -o '"response":"[^"]*"' | head -1)

if [ -n "$TEST_RESPONSE" ]; then
  echo -e "${GREEN}✓ Ollama is working correctly${NC}"
  echo "Response: $TEST_RESPONSE"
else
  echo -e "${RED}✗ Failed to get response from Ollama${NC}"
  exit 1
fi
echo ""

# Summary
echo -e "${GREEN}════════════════════════════════${NC}"
echo -e "${GREEN}✓ Ollama Setup Complete!${NC}"
echo -e "${GREEN}════════════════════════════════${NC}"
echo ""
echo "Available models:"
ollama list
echo ""
echo -e "${BLUE}Usage:${NC}"
echo "  repowiki ask --provider ollama --model $MODEL \"What is this project?\""
echo ""
echo -e "${BLUE}Run tests:${NC}"
echo "  ./scripts/test-with-ollama.sh"
