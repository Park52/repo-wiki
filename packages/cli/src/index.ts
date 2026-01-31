#!/usr/bin/env node
/**
 * RepoWiki CLI
 * Agentic AI for repository Q&A and wiki generation
 */

import { Command } from 'commander';
import { askCommand } from './commands/ask.js';
import { wikiCommand } from './commands/wiki.js';
import { indexCommand } from './commands/index-cmd.js';

const program = new Command();

program
  .name('repowiki')
  .description('Agentic AI CLI for repository Q&A and wiki generation')
  .version('0.0.1');

program.addCommand(askCommand);
program.addCommand(wikiCommand);
program.addCommand(indexCommand);

program.parse();
