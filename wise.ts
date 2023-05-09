#!/usr/bin/env node --loader ts-node/esm
import { default as fs, promises as fsp } from 'fs'
import { Configuration, OpenAIApi } from "openai"
import dotenv from 'dotenv'
import chalk from 'chalk'
import yargs from 'yargs'
import { createInterface } from 'readline'

/////////

// FILES

// - dialogues file should be a list of dialogues separated by `---`
// - prompts file should have sections for each prompt
//   (e.g. `# getRelevantValue`, `# updateMoralFramework`, `# generateResponse` and `# startingValues`)


/////////
// config

const log = console.log
dotenv.config();
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);
let prompts: { [prompt: string]: string } = {};
let model: 'gpt-4' | 'gpt-3.5-turbo' = 'gpt-4'
let verbose = false
let runEvals = false
let compare = false
let traceFile: string | null = null
const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});


// CODE

// This is the main function that takes a dialogue and a moral framework and returns a response.

async function wiseResponse(dialogue: string, values: string) {
  // ASSESS MORAL SITUATION
  const situation = await llm(prompts['situation'], dialogue, 'SITUATION');
  trace('situation', 'wise', dialogue, situation)

  // FIND A RELEVANT VALUE
  let relevantValue = await getRelevantValue(values, situation);
  if (relevantValue.match(/^None/)) {
    let previousValues = values;
    values = (await getUpdatedValues(values, dialogue, situation)).split('\n---\n').pop()!;
    trace('upgrade', 'wise', dialogue, values, { previousValues, situation })
    relevantValue = await getRelevantValue(values, situation);
  }
  if (relevantValue.match(/^None/)) throw new Error('Could not find relevant value')

  // GENERATE RESPONSE
  const response = await getResponse(relevantValue, dialogue)
  trace('response', 'wise', dialogue, response, { considerations: situation })

  if (compare) {
    // base response
    const baseResponse = await llm(prompts['baseResponse'], dialogue, 'BASE RESPONSE')
    trace('response', 'baseline', dialogue, baseResponse, { considerations: situation })

    // clever response
    const cleverResponse = await llm(prompts['cleverResponse'], dialogue, 'CLEVER RESPONSE')
    trace('response', 'clever', dialogue, cleverResponse, { considerations: situation })
  }

  // RETURN IT
  return { response, relevantValue, situation, values }
}

// This is an alternative function that runs the evals for a dialogue and a moral framework.

// These are the functions that run the prompts.

async function getRelevantValue(values: string, situation: string) {
  return await llm(prompts['relevantValue'], pack({
    'ATTENTIONAL POLICIES': values,
    'THINGS TO BE AWARE OF': situation,
  }), 'RELEVANT VALUE')
}

async function getUpdatedValues(values: string, dialogue: string, situation: string) {
  return await llm(prompts['updateValues'], pack({
    'ATTENTIONAL POLICIES': values,
    'CHALLENGING CHAT': dialogue,
    'CONSIDERATIONS': situation,
  }), 'UPDATED VALUES')
}

async function getResponse(value: string, dialogue: string) {
  return await llm(prompts['response'], pack({
    'ATTENTIONAL POLICY': value,
    'DIALOGUE': dialogue,
  }), 'RESPONSE')
}



// HELPER FUNCTIONS

function logDialogue(dialogue: string) {
  log(chalk.bgBlue('[CHECKING DIALOGUE]'))
  log(chalk.blue(dialogue))
}

function logRequest(logAs: string, ...args: string[]) {
  if (!verbose) log(chalk.bgGreen(`[${logAs}]`))
  if (verbose) {
    log(chalk.bgYellow(`[ISSUING REQUEST: ${logAs}]`))
    log(chalk.yellow(...args))
  }
}

function logResponse(logAs: string, response: string) {
  if (verbose) log(chalk.bgGreen(`[${logAs}]`))
  log(chalk.green(response))
}

function pack(contents: Record<string, string>) {
  return Object.entries(contents).map(([key, value]) => `-- - ${key} ---\n\n${value} \n`).join('\n')
}

async function llm(systemPrompt: string, userPrompt: string, logAs: string) {
  logRequest(logAs, systemPrompt, userPrompt)
  const completion = await openai.createChatCompletion({
    model,
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

interface Args {
  3: boolean,
  4: boolean,
  v: boolean,
  e: boolean,
  c: boolean,
}

interface InteractArgs extends Args {
  promptsFile: string,
  traceFile?: string,
}

interface RunArgs extends Args {
  promptsFile: string,
  dialoguesFile: string,
  traceFile?: string,
}

function processBaseArgs(args: Args) {
  if (args['3']) model = 'gpt-3.5-turbo'
  if (args['4']) model = 'gpt-4'
  if (args['v']) verbose = true
  if (args['e']) runEvals = true
  if (args['c']) compare = true
  console.log('Using model', model)
}

async function runInteract(args: InteractArgs) {
  processBaseArgs(args)
  prompts = await loadFileAndSplitSections(args['promptsFile']!)
  if (args.traceFile) traceFile = args.traceFile
  let dialogue = ''
  let values = prompts['startingValues']
  rl.setPrompt('> ');
  rl.prompt();
  rl.on('line', async (line) => {
    if (line.trim() === 'exit') {
      console.log('Goodbye!');
      rl.close();
    }
    // build a dialogue
    if (!dialogue) dialogue = `HUMAN: ${line}\nBOT:`
    else dialogue += `\nHUMAN: ${line}\nBOT:`
    const response = await wiseResponse(line, values)
    values = response.values
    dialogue += `\nBOT: ${response.response}`
    rl.prompt()
  })
  rl.on('close', () => {
    console.log('Goodbye!');
    process.exit(0);
  })
}

async function runDialogues(args: RunArgs) {
  processBaseArgs(args)
  prompts = await loadFileAndSplitSections(args['promptsFile']!)
  if (args.traceFile) traceFile = args.traceFile
  const dialogues = (await fsp.readFile(args.dialoguesFile, 'utf-8')).split(/\r?\n---\r?\n/);
  for (let dialogue of dialogues) {
    // wise response
    logDialogue(dialogue)
    if (!dialogue.match(/HUMAN/)) dialogue = `HUMAN: ${dialogue}\nBOT:`
    await wiseResponse(dialogue, prompts['startingValues'])
  }
}

async function evaluate(trace: Trace) {
  const evalPrompt = prompts[`eval-${trace.eventType}`]
  if (!evalPrompt) return
  const completedDialogue = trace.dialogue + '\n' + trace.completion
  const { considerations } = trace.parameters as { considerations: string }
  return await llm(evalPrompt, pack({
    'COMPLETED DIALOGUE': completedDialogue,
    'CONSIDERATIONS': considerations,
  }), 'EVALUATION')
}

// async function runEval(args: EvalArgs) {
//   processBaseArgs(args)
//   const jsonChunks = fs.createReadStream(args.traceFile, { encoding: 'utf-8' }).pipe(concatjson.parse())
//   for await (const chunk of jsonChunks) {
//     const trace = chunk as Trace
//     const score = await evaluate(trace)
//     console.log({
//       score,
//       trace
//     })
//   }
// }

interface Trace {
  eventType: 'response' | 'situation' | 'upgrade',
  runType: 'baseline' | 'clever' | 'wise',
  model: 'gpt-3.5-turbo' | 'gpt-4',
  dialogue: string,
  completion: string,
  parameters?: Record<string, string>
  score?: string | null,
}

async function trace(eventType: Trace['eventType'], runType: Trace['runType'], dialogue: string, completion: string, parameters?: Record<string, string>) {
  if (!traceFile) return
  const obj: Trace = { eventType, runType, model, dialogue, completion, parameters }
  if (runEvals) {
    obj.score = await evaluate({ eventType, runType, model, dialogue, completion, parameters })
  }
  fs.appendFileSync(traceFile, JSON.stringify(obj) + '\n')
}

// RUN IT!
yargs(process.argv.slice(2))
  .option('3', {
    type: 'boolean',
    description: 'Use gpt 3.5',
  })
  .option('4', {
    type: 'boolean',
    description: 'use gpt 4',
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
  .option('c', {
    alias: 'comparative',
    type: 'boolean',
    description: 'Compare with baseline model responses',
  })
  // .command<EvalArgs>(
  //   'eval <tracefile>',
  //   '',
  //   (yargs) => {
  //     return yargs
  //       .positional('tracefile', {
  //         type: 'string',
  //         description: 'Path to the tracefile',
  //         demandOption: true,
  //       })
  //       .option('e', {
  //         alias: "evalPromptsFile",
  //         nargs: 1,
  //         desc: 'load eval prompts from <file>',
  //         default: './data/evals/joe.txt'
  //       })
  //   },
  //   runEval
  // )
  .option('promptsFile', {
    alias: "p",
    nargs: 1,
    description: 'load prompts from <file>',
    default: './data/prompts/joe'
  })
  .option('traceFile', {
    alias: 't',
    type: 'string',
    description: 'Leave a trace in a tracefile (for later evaluation)',
    default: `trace-${Date.now()}.jsonl`
  })
  .command<InteractArgs>(
    'interact',
    'Interact with the system',
    () => { },
    runInteract
  )
  .command<RunArgs>(
    'run [dialoguesFile]',
    '',
    (yargs) => {
      return yargs
        .positional('dialoguesFile', {
          type: 'string',
          description: 'Path to the dialogues file',
          default: './data/dialogues/joe.txt',
        })
    },
    runDialogues
  )
  .demandCommand(1, 'You need at least one command before moving on')
  .help()
  .alias('h', 'help')
  .argv;
