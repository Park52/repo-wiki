# Contributing to RepoWiki

Thank you for your interest in contributing to RepoWiki! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Git

### Getting Started

1. **Fork and clone the repository**

```bash
git clone https://github.com/YOUR_USERNAME/repo-wiki.git
cd repo-wiki
```

2. **Install dependencies**

```bash
npm install
```

3. **Build the project**

```bash
npm run build
```

4. **Run tests**

```bash
npm test
```

## Project Structure

```
repo-wiki/
├── packages/
│   ├── core/          # Core library (agent, LLM, tools, indexer)
│   │   └── src/
│   │       ├── agent/     # Agent loop and verifier
│   │       ├── llm/       # LLM providers
│   │       ├── tools/     # Tool definitions and registry
│   │       ├── indexer/   # SQLite FTS5 indexer
│   │       └── types.ts   # Type definitions
│   │
│   └── cli/           # CLI application
│       └── src/
│           └── commands/  # CLI commands (ask, wiki, index)
│
├── .github/
│   └── workflows/     # CI/CD workflows
│
└── docs/              # Documentation
```

## Development Workflow

### Making Changes

1. Create a new branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following the coding standards

3. Write or update tests as needed

4. Run tests and ensure they pass:
   ```bash
   npm test
   ```

5. Build and check for type errors:
   ```bash
   npm run build
   ```

6. Commit your changes with a descriptive message:
   ```bash
   git commit -m "feat: add new feature description"
   ```

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `test:` Adding or updating tests
- `refactor:` Code refactoring
- `chore:` Maintenance tasks

### Pull Requests

1. Push your branch to your fork
2. Create a Pull Request against the `main` branch
3. Ensure CI checks pass
4. Wait for code review

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

- Place test files in `__tests__` directories
- Name test files with `.test.ts` suffix
- Use descriptive test names

Example:
```typescript
describe('ToolRegistry', () => {
  it('should execute get_excerpt tool correctly', async () => {
    // Arrange
    const registry = createToolRegistry('/path/to/repo');
    
    // Act
    const result = await registry.executeToolCall('get_excerpt', {
      path: 'src/index.ts',
      startLine: 1,
      endLine: 10,
    });
    
    // Assert
    expect(result.success).toBe(true);
  });
});
```

## Code Style

- Use TypeScript for all source files
- Use ESM imports (`.js` extensions in imports)
- Follow existing code patterns
- Add JSDoc comments for public APIs

## Adding New Tools

To add a new tool to the agent:

1. Define the Zod schema in `packages/core/src/tools/schemas.ts`
2. Implement the tool handler in `packages/core/src/tools/handlers/`
3. Register the tool in `packages/core/src/tools/registry.ts`
4. Add tests for the new tool

## Questions?

Feel free to open an issue for:
- Bug reports
- Feature requests
- Questions about the codebase

Thank you for contributing! 🎉
