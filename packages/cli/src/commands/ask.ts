/**
 * Ask command - Query the repository using AgentLoop
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as path from 'node:path';
import {
  runAgent,
  createProvider,
  Indexer,
  type StepLog,
  type ProviderType,
} from '@repo-wiki/core';
import {
  checkApiKeyForProvider,
  checkIndexExists,
  getDbPath,
  ensureDir,
  writeFile,
  formatStepLog,
  formatTime,
  printHeader,
} from '../utils.js';

const SUPPORTED_PROVIDERS = ['openai', 'anthropic', 'ollama', 'lmstudio', 'together', 'groq', 'openai-compatible'];

export const askCommand = new Command('ask')
  .description('Ask a question about the repository')
  .argument('<question>', 'Question to ask about the codebase')
  .option('-r, --repo <path>', 'Repository path', process.cwd())
  .option('-p, --provider <provider>', 'LLM provider (openai, anthropic, ollama, lmstudio, together, groq)', 'openai')
  .option('-m, --model <model>', 'LLM model to use')
  .option('-u, --base-url <url>', 'Base URL for API (for local/custom providers)')
  .option('-s, --max-steps <n>', 'Maximum agent steps', '8')
  .option('-o, --out <path>', 'Output path for answer markdown')
  .option('--steps <path>', 'Output path for steps JSON')
  .option('-v, --verbose', 'Show detailed step information')
  .action(async (question: string, options) => {
    const spinner = ora();
    const repoPath = path.resolve(options.repo);
    const providerType = options.provider as ProviderType;

    try {
      // Validate provider
      if (!SUPPORTED_PROVIDERS.includes(providerType)) {
        throw new Error(
          `Unknown provider: ${providerType}. ` +
          `Supported: ${SUPPORTED_PROVIDERS.join(', ')}`
        );
      }

      // Check API key (not needed for local providers)
      checkApiKeyForProvider(providerType);

      // Default model per provider
      const model = options.model ?? getDefaultModel(providerType);

      printHeader('RepoWiki Ask');
      console.log(chalk.gray(`Repository: ${repoPath}`));
      console.log(chalk.gray(`Provider: ${providerType} | Model: ${model}`));
      console.log(chalk.gray(`Question: ${question}`));
      console.log('');

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

      // Create LLM provider
      const llmProvider = createProvider({
        provider: providerType,
        model,
        baseUrl: options.baseUrl,
      });

      // Run agent loop
      spinner.start('Thinking...');
      
      const result = await runAgent({
        repoRoot: repoPath,
        dbPath: getDbPath(repoPath),
        question,
        llmProvider,
        maxSteps: parseInt(options.maxSteps, 10),
        verbose: options.verbose,
      });

      spinner.stop();

      // Display steps if verbose
      if (options.verbose) {
        console.log('');
        console.log(chalk.blue('Steps:'));
        for (const step of result.steps) {
          console.log(formatStepLog(step));
        }
        console.log('');
      }

      // Display result
      if (result.verified) {
        console.log(chalk.green('✓ Answer verified'));
      } else if (result.error) {
        console.log(chalk.yellow(`⚠ ${result.error}`));
      }
      
      console.log(chalk.gray(`Total time: ${formatTime(result.totalMs)}, Steps: ${result.steps.length}, Provider: ${providerType}`));
      console.log('');
      console.log(chalk.cyan('─'.repeat(60)));
      console.log('');
      console.log(result.answerMd);
      console.log('');

      // Save answer if output path specified
      if (options.out) {
        const outPath = path.resolve(options.out);
        ensureDir(path.dirname(outPath));
        writeFile(outPath, result.answerMd);
        console.log(chalk.green(`✓ Answer saved to ${outPath}`));
      }

      // Save steps if path specified
      if (options.steps) {
        const stepsPath = path.resolve(options.steps);
        ensureDir(path.dirname(stepsPath));
        const stepsJson = JSON.stringify(
          {
            question,
            repoPath,
            model: options.model,
            totalMs: result.totalMs,
            verified: result.verified,
            error: result.error,
            steps: result.steps,
            sources: result.sources,
          },
          null,
          2
        );
        writeFile(stepsPath, stepsJson);
        console.log(chalk.green(`✓ Steps saved to ${stepsPath}`));
      }

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
