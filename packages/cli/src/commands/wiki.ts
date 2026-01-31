/**
 * Wiki command - Generate wiki documentation using AgentLoop
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  runAgent,
  createProvider,
  Indexer,
  type Source,
  type ProviderType,
} from '@repo-wiki/core';
import {
  checkApiKeyForProvider,
  checkIndexExists,
  getDbPath,
  ensureDir,
  writeFile,
  formatTime,
  printHeader,
} from '../utils.js';

// Wiki page types and their prompts
const WIKI_PAGES: Record<string, { title: string; prompt: string }> = {
  overview: {
    title: 'Overview',
    prompt: `Generate a wiki page titled "Overview" for this repository.

Include:
1. What is this project? (purpose and goals)
2. Key features and capabilities
3. Technology stack used
4. Project structure overview
5. Who is the target audience?

Format as a well-structured Markdown document with clear headings.`,
  },
  build: {
    title: 'Build & Setup',
    prompt: `Generate a wiki page titled "Build & Setup" for this repository.

Include:
1. Prerequisites (required tools, versions)
2. Installation steps
3. Configuration options (environment variables, config files)
4. Build commands
5. Running the project (development and production)
6. Common issues and troubleshooting

Format as a well-structured Markdown document with code examples.`,
  },
  architecture: {
    title: 'Architecture',
    prompt: `Generate a wiki page titled "Architecture" for this repository.

Include:
1. High-level architecture diagram description
2. Main components and their responsibilities
3. Data flow between components
4. Key design patterns used
5. External dependencies and integrations
6. Directory structure explanation

Format as a well-structured Markdown document with clear explanations.`,
  },
  modules: {
    title: 'Modules',
    prompt: `Generate a wiki page titled "Modules" for this repository.

Include:
1. List of all main modules/packages
2. For each module:
   - Purpose and responsibility
   - Key files and their roles
   - Public API/exports
   - Dependencies on other modules
3. How modules interact with each other

Format as a well-structured Markdown document.`,
  },
};

interface WikiPage {
  type: string;
  title: string;
  content: string;
  sources: Source[];
  verified: boolean;
  timeMs: number;
}

export const wikiCommand = new Command('wiki')
  .description('Generate wiki documentation for the repository')
  .option('-r, --repo <path>', 'Repository path', process.cwd())
  .option('-o, --out <dir>', 'Output directory for wiki', './wiki')
  .option('-p, --provider <provider>', 'LLM provider (openai, anthropic, ollama, lmstudio, together, groq)', 'openai')
  .option('-m, --model <model>', 'LLM model to use')
  .option('-u, --base-url <url>', 'Base URL for API (for local/custom providers)')
  .option('--page <type>', 'Specific page to generate: overview|build|architecture|modules')
  .option('-a, --all', 'Generate all wiki pages')
  .option('-v, --verbose', 'Show detailed progress')
  .action(async (options) => {
    const spinner = ora();
    const repoPath = path.resolve(options.repo);
    const outputDir = path.resolve(options.out);
    const providerType = (options.provider || 'openai') as ProviderType;

    try {
      // Check API key (not needed for local providers)
      checkApiKeyForProvider(providerType);

      // Default model per provider
      const model = options.model ?? getDefaultModel(providerType);

      printHeader('RepoWiki Generator');
      console.log(chalk.gray(`Repository: ${repoPath}`));
      console.log(chalk.gray(`Output: ${outputDir}`));
      console.log(chalk.gray(`Provider: ${providerType} | Model: ${model}`));
      console.log('');

      // Determine which pages to generate
      let pagesToGenerate: string[];
      
      if (options.all) {
        pagesToGenerate = Object.keys(WIKI_PAGES);
      } else if (options.page) {
        const pageType = options.page.toLowerCase();
        if (!WIKI_PAGES[pageType]) {
          console.error(chalk.red(`Unknown page type: ${options.page}`));
          console.error('');
          console.error('Available page types:');
          Object.keys(WIKI_PAGES).forEach((type) => {
            console.error(`  - ${type}: ${WIKI_PAGES[type]?.title}`);
          });
          process.exit(1);
        }
        pagesToGenerate = [pageType];
      } else {
        console.error(chalk.yellow('Please specify a page to generate:'));
        console.error('');
        console.error('Options:');
        console.error('  --page <type>  Generate specific page (overview|build|architecture|modules)');
        console.error('  --all          Generate all pages');
        console.error('');
        console.error('Example:');
        console.error('  repowiki wiki --page overview');
        console.error('  repowiki wiki --all');
        process.exit(1);
      }

      // Check if index exists
      if (!checkIndexExists(repoPath)) {
        console.log(chalk.yellow('⚠ No index found for this repository.'));
        console.log('');
        console.log('Creating index first...');
        
        spinner.start('Indexing repository...');
        const indexer = new Indexer({ repoPath });
        const { indexed, skipped } = await indexer.indexRepository();
        indexer.close();
        spinner.succeed(`Indexed ${indexed} files (${skipped} skipped)`);
        console.log('');
      }

      // Create output directory
      ensureDir(outputDir);

      // Create LLM provider
      const llmProvider = createProvider({
        provider: providerType,
        model,
        baseUrl: options.baseUrl,
      });

      const generatedPages: WikiPage[] = [];

      // Generate each page
      for (const pageType of pagesToGenerate) {
        const pageConfig = WIKI_PAGES[pageType];
        if (!pageConfig) continue;

        spinner.start(`Generating: ${pageConfig.title}...`);
        const startTime = Date.now();

        const result = await runAgent({
          repoRoot: repoPath,
          dbPath: getDbPath(repoPath),
          question: pageConfig.prompt,
          llmProvider,
          maxSteps: 8,
          verbose: options.verbose,
        });

        const elapsed = Date.now() - startTime;

        if (result.verified) {
          spinner.succeed(`Generated: ${pageConfig.title} (${formatTime(elapsed)})`);
        } else {
          spinner.warn(`Generated: ${pageConfig.title} (unverified, ${formatTime(elapsed)})`);
        }

        generatedPages.push({
          type: pageType,
          title: pageConfig.title,
          content: result.answerMd,
          sources: result.sources,
          verified: result.verified,
          timeMs: elapsed,
        });
      }

      // Write wiki files
      console.log('');
      spinner.start('Writing wiki files...');

      for (const page of generatedPages) {
        const filename = `${page.type}.md`;
        const filepath = path.join(outputDir, filename);
        
        // The answer should already include sources section from agent
        writeFile(filepath, page.content);
      }

      // Write index/README if multiple pages
      if (generatedPages.length > 1) {
        const indexContent = `# Repository Wiki

> Generated by RepoWiki

## Contents

${generatedPages.map((p) => `- [${p.title}](./${p.type}.md)`).join('\n')}

---

*Generated on ${new Date().toISOString().split('T')[0]}*
`;
        writeFile(path.join(outputDir, 'README.md'), indexContent);
      }

      spinner.succeed('Wiki files written');
      console.log('');
      console.log(chalk.green('Generated pages:'));
      generatedPages.forEach((p) => {
        const status = p.verified ? chalk.green('✓') : chalk.yellow('⚠');
        console.log(`  ${status} ${p.title} → ${p.type}.md`);
      });
      console.log('');
      console.log(chalk.gray(`Output directory: ${outputDir}`));

    } catch (error) {
      spinner.fail('Failed');
      console.error('');
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      
      if (error instanceof Error) {
        if (error.message.includes('API')) {
          console.error('');
          console.error('Make sure the required API key is set correctly.');
          console.error('  OpenAI:    OPENAI_API_KEY');
          console.error('  Anthropic: ANTHROPIC_API_KEY');
          console.error('  Together:  TOGETHER_API_KEY');
          console.error('  Groq:      GROQ_API_KEY');
        }
        if (error.message.includes('ECONNREFUSED')) {
          console.error('');
          console.error('For local providers, make sure the server is running:');
          console.error('  Ollama:    ollama serve');
          console.error('  LM Studio: Start the server in the app');
        }
      }
      
      process.exit(1);
    }
  });

/**
 * Get default model for each provider
 */
function getDefaultModel(provider: ProviderType): string {
  switch (provider) {
    case 'openai':
      return 'gpt-4o';
    case 'anthropic':
      return 'claude-3-5-sonnet-latest';
    case 'ollama':
      return 'llama3.1';
    case 'lmstudio':
      return 'local-model';
    case 'together':
      return 'meta-llama/Llama-3-70b-chat-hf';
    case 'groq':
      return 'llama-3.1-70b-versatile';
    default:
      return 'gpt-4o';
  }
}
