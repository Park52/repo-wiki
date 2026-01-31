/**
 * Index command - Build or rebuild the repository index
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { Indexer } from '@repo-wiki/core';

export const indexCommand = new Command('index')
  .description('Build or rebuild the repository index')
  .option('-r, --repo <path>', 'Repository path', process.cwd())
  .action(async (options) => {
    const spinner = ora();

    try {
      spinner.start('Indexing repository...');

      const indexer = new Indexer({
        repoPath: options.repo,
      });

      const { indexed, skipped } = await indexer.indexRepository();

      indexer.close();

      spinner.succeed('Indexing complete');
      console.log(`\n${chalk.green('Indexed:')} ${indexed} files`);
      console.log(`${chalk.gray('Skipped:')} ${skipped} files`);
    } catch (error) {
      spinner.fail('Indexing failed');
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
