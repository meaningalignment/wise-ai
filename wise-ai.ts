#!/usr/bin/env node_modules/.bin/tsx
import { default as fs, promises as fsp } from 'fs'
import { Configuration, OpenAIApi } from "openai"
import dotenv from 'dotenv'
import chalk from 'chalk'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { createInterface } from 'readline'

const DEFAULT_DIALOGUES = './dialogues.txt'
const DEFAULT_PERSONAS = './personas.md'
const DEFAULT_PROMPTS = './default-prompts.md'
const DEFAULT_MODEL = 'gpt-4'
// const DEFAULT_PERSONA = 'abortion'


//////////////////
// CONFIG

dotenv.config();
const openai = new OpenAIApi(new Configuration({ apiKey: process.env.OPENAI_API_KEY }));
let flags: Flags | null = null

interface Flags {
  3: boolean,
  verbose: boolean,
  runEvals: boolean,
  promptsFile: string,
  personasFile: string,
  traceFile: string,
}

//////////////////
// MAIN FUNCTIONS

async function joelResponse(dialogue: string) {
  return await prompt('joel-response', dialogue)
}

async function humanSimResponse(dialogue: string, persona: string) {
  const p = await getPersona(persona)
  return llm(p, dialogue, `persona-${persona}`)
}

async function wiseResponse(dialogue: string, values: string) {
  // ASSESS MORAL SITUATION
  const situation = await prompt('situation', dialogue);
  await trace('situation', dialogue, {}, situation)

  // FIND A RELEVANT VALUE
  let relevantValue = await getRelevantValue(values, dialogue, situation);
  if (relevantValue.match(/^None/)) {
    let previousValues = values;
    values = (await getUpdatedValues(values, dialogue, situation)).split('\n---\n').pop()!;
    await trace('upgrade', dialogue, { previousValues, situation }, values)
    relevantValue = await getRelevantValue(values, dialogue, situation);
  }
  if (relevantValue.match(/^None/)) throw new Error('Could not find relevant value')

  // GENERATE RESPONSE
  const response = await getResponse(relevantValue, dialogue)
  await trace('response', dialogue, { considerations: situation }, response)

  // RETURN IT
  return { response, relevantValue, situation, values }
}

async function runInteract(args: Flags) {
  flags = args
  console.log('Using model', model())
  let dialogue = ''
  let values = await getPrompt('starting-values')
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.setPrompt('> ');
  rl.prompt();
  rl.on('line', async (line) => {
    if (line.trim() === 'exit') return rl.close()

    if (dialogue) dialogue += `\n`
    dialogue += `\nHUMAN: ${line}\nBOT:`
    const response = await wiseResponse(dialogue, values)
    values = response.values
    dialogue += `\nBOT: ${response.response}`
    rl.prompt()
  })
  rl.on('close', () => {
    console.log('Goodbye!');
    process.exit(0);
  })
}

async function runDialogueSim(args: Flags & { persona: string }) {
  flags = args
  console.log('Using model', model())
  let dialogue = 'HUMAN: '
  let values = await getPrompt('starting-values')
  for (let i = 0; i < 2; i++) {
    let line = await humanSimResponse(dialogue, args.persona);
    if (dialogue) dialogue += `\n`
    dialogue += `${line}\nBOT: `
    const response = await wiseResponse(dialogue, values)
    values = response.values
    dialogue += `${response.response}\nHUMAN: `
    console.log(chalk.blue(dialogue))
  }
}

async function runDialogues(args: Flags & { dialoguesFile: string }) {
  console.log('Using model', model())
  flags = args
  const dialogues = (await fsp.readFile(args.dialoguesFile, 'utf-8')).split(/\r?\n---\r?\n/);
  const values = await getPrompt('starting-values')
  for (let dialogue of dialogues) {
    // wise response
    console.log(chalk.bgBlue('[CHECKING DIALOGUE]'))
    console.log(chalk.blue(dialogue))
    if (!dialogue.match(/HUMAN/)) dialogue = `HUMAN: ${dialogue}\nBOT:`
    await wiseResponse(dialogue, values)
  }
}

type ResponseType = 'wise' | 'baseline' | 'clever' | 'joel'

//     await trace('response', 'baseline', dialogue, baseResponse, { considerations: situation })

async function getResponseOfType(type: ResponseType, dialogue: string) {
  if (type === 'wise') {
    return (await wiseResponse(dialogue, await getPrompt('starting-values'))).response
  } else if (type === 'baseline') {
    return await prompt('base-response', dialogue)
  } else if (type === 'joel') {
    return await joelResponse(dialogue)
  } else {
    return await prompt('clever-response', dialogue)
  }
}

async function runBattle(args: Flags & { left: ResponseType, right: ResponseType, dialoguesFile: string }) {
  flags = args

  console.log('Using model', model())
  const dialogues = (await fsp.readFile(args.dialoguesFile, 'utf-8')).split(/\r?\n---\r?\n/);
  for (let dialogue of dialogues) {
    console.log(chalk.bgBlue('[CHECKING DIALOGUE]'))
    console.log(chalk.blue(dialogue))
    const leftResponse = await getResponseOfType(args.left, dialogue)
    const rightResponse = await getResponseOfType(args.right, dialogue)
    const output = await prompt('eval-battle', pack({
      'DIALOGUE': dialogue,
      'LEFT RESPONSE': leftResponse,
      'RIGHT RESPONSE': rightResponse,
    }))
    await trace('battle', dialogue, {
      leftModel: args.left,
      rightModel: args.right,
      leftResponse,
      rightResponse,
    }, output)
  }
}


//////////////////
// Various prompts

async function getRelevantValue(values: string, dialogue: string, situation: string) {
  return await prompt('relevant-value', pack({
    'ATTENTIONAL POLICIES': values,
    'CHALLENGING CHAT': dialogue,
    'WAYS IT COULD GO': situation,
  }))
}

async function getUpdatedValues(values: string, dialogue: string, situation: string) {
  return await prompt('update-values', pack({
    'ATTENTIONAL POLICIES': values,
    'CHALLENGING CHAT': dialogue,
    'WAYS IT COULD GO': situation,
  }))
}

async function getResponse(value: string, dialogue: string) {
  return await prompt('response', pack({
    'ATTENTIONAL POLICY': value,
    'DIALOGUE': dialogue,
  }))
}


//////////////////
// LLM HELPERS

function model() {
  if (flags?.['3']) return 'gpt-3.5-turbo'
  else return DEFAULT_MODEL
}

function pack(contents: Record<string, string>) {
  return Object.entries(contents).map(([key, value]) => `--- ${key} ---\n\n${value} \n`).join('\n')
}

let prompts: { [prompt: string]: string } | null
async function getPrompt(name: string) {
  if (!prompts) prompts = await loadFileAndSplitSections(flags?.['promptsFile']!)
  if (!prompts[name]) throw new Error(`No prompt named ${name}`)
  return prompts[name]
}

let personas: { [persona: string]: string } | null
async function getPersona(name: string) {
  if (!personas) personas = await loadFileAndSplitSections(flags?.['personasFile']!)
  if (!personas[name]) throw new Error(`No persona named ${name}`)
  return personas[name]
}

async function prompt(name: string, userPrompt: string) {
  const p = await getPrompt(name)
  return llm(p, userPrompt, name)
}

async function llm(systemPrompt: string, userPrompt: string, logAs: string) {
  logRequest(logAs, systemPrompt, userPrompt)
  //console.log(chalk.yellow(systemPrompt))
  const completion = await openai.createChatCompletion({
    model: model(),
    messages: [
      { content: systemPrompt, role: "system" },
      { content: userPrompt, role: "user" }
    ],
    max_tokens: 2000,
  });
  const result = completion.data.choices[0].message?.content as string
  logResponse(logAs, result)
  return result;
}

function logRequest(logAs: string, ...args: string[]) {
  if (!flags?.verbose) console.log(chalk.bgGreen(`[${logAs}]`))
  if (flags?.verbose) {
    console.log(chalk.bgYellow(`[ISSUING REQUEST: ${logAs}]`))
    console.log(chalk.yellow(...args))
  }
}

function logResponse(logAs: string, response: string) {
  if (flags?.verbose) console.log(chalk.bgGreen(`[${logAs}]`))
  console.log(chalk.green(response))
}


//////////////////
// FILE HELPERS

async function loadFileAndSplitSections(filePath: string) {
  const sectionPattern = /^# (.+)/;
  const sections = {} as Record<string, string>;

  const fileContent = await fsp.readFile(filePath, 'utf-8');
  const lines = fileContent.split(/\r?\n/);

  let currentSection = '';

  for (const line of lines) {
    const match = line.match(sectionPattern);

    if (match) {
      currentSection = match[1];
      sections[currentSection] = '';
    } else if (currentSection) {
      sections[currentSection] += line + '\n';
    }
  }

  return sections;
}

interface Trace {
  eventType: 'response' | 'situation' | 'upgrade' | 'battle',
  model: 'gpt-3.5-turbo' | 'gpt-4',
  dialogue: string,
  parameters: Record<string, string>
  output: string,
  evaluation?: string,
}

async function trace(eventType: Trace['eventType'], dialogue: string, parameters: Record<string, string>, output: string) {
  if (!flags?.traceFile) return
  const t: Trace = { eventType, model: model(), dialogue, parameters, output }
  if (flags?.runEvals) {
    const promptName = `eval-${t.eventType}`
    const evalPrompt = await getPrompt(promptName)
    if (evalPrompt) {
      t.evaluation = await prompt(promptName, pack({
        'TASK': t.dialogue,
        'SUBMISSION': t.output,
      }))
    }
  }
  if (!fs.existsSync('./outputs')) fs.mkdirSync('./outputs')
  fs.appendFileSync(flags?.traceFile, JSON.stringify(t) + '\n')
}


//////////////////
// MAIN

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
  .command<Flags>(
    'interact',
    'Interact with the system',
    () => { },
    runInteract
  )
  .command<Flags & { persona: string }>(
    'simconv <persona>',
    'Simulate a conversation',
    (yargs) => {
      return yargs
        .positional('persona', {
          type: 'string',
          description: 'Persona to use from personas.md',
          demandOption: true,
          // default: DEFAULT_PERSONA,
        })
    },
    runDialogueSim
  )
  .command<Flags & { dialoguesFile: string }>(
    'run [dialoguesFile]',
    '',
    (yargs) => {
      return yargs
        .positional('dialoguesFile', {
          type: 'string',
          description: 'Path to the dialogues file',
          default: DEFAULT_DIALOGUES,
        })
    },
    runDialogues
  )
  .command<Flags & { dialoguesFile: string, left: ResponseType, right: ResponseType }>(
    'battle <left> <right> [dialoguesFile]]',
    '',
    (yargs) => {
      return yargs
        .positional('left', {
          type: 'string',
          description: 'left model',
          demandOption: true,
          choices: ['baseline', 'clever', 'wise', 'joel']
        })
        .positional('right', {
          type: 'string',
          description: 'right model',
          demandOption: true,
          choices: ['baseline', 'clever', 'wise', 'joel']
        })
        .positional('dialoguesFile', {
          type: 'string',
          description: 'Path to the dialogues file',
          default: DEFAULT_DIALOGUES,
        })
    },
    runBattle
  )
  .demandCommand(1, 'You need to specify a command: either `interact` or `run`.')
  .help()
  .alias('h', 'help')
  .argv;

