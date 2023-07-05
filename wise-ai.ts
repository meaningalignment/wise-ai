#!/usr/bin/env node_modules/.bin/tsx
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import * as cmd_simconv from 'src/cmd_simconv'
import * as cmd_battle from 'src/cmd_battle'
import * as cmd_interact from 'src/cmd_interact'
import * as cmd_run from 'src/cmd_run'

const DEFAULT_PERSONAS = './prompts/personas.md'
const DEFAULT_PROMPTS = './prompts/default-prompts.md'

yargs(hideBin(process.argv))
  .option('3', {
    type: 'boolean',
    description: 'Use gpt 3.5',
  })
  .option('v', {
    alias: 'verbose',
    type: 'boolean',
    description: 'Enable verbose mode',
  })
  .option('e', {
    alias: 'runEvals',
    type: 'boolean',
    description: 'Run evals',
  })
  .option('promptsFile', {
    alias: "p",
    nargs: 1,
    description: 'load prompts from <file>',
    default: DEFAULT_PROMPTS
  })
  .option('personasFile', {
    alias: "P",
    nargs: 1,
    description: 'load personas from <file>',
    default: DEFAULT_PERSONAS
  })
  .option('traceFile', {
    alias: 't',
    type: 'string',
    description: 'Leave a trace in a tracefile (for later evaluation)',
    default: `outputs/trace-${Date.now()}.jsonl`
  })
  .command([cmd_interact, cmd_battle, cmd_simconv, cmd_run])
  .demandCommand(1, 'You need to specify a command.')
  .help()
  .alias('h', 'help')
  .argv;

