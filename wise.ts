import { promises as fs } from 'fs';
import { Configuration, OpenAIApi } from "openai"
import dotenv from 'dotenv';
import chalk from 'chalk'
import yargs from 'yargs'

// config
const log = console.log
dotenv.config();
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);
let prompts: { [prompt: string]: string } = {};
let evals: { [prompt: string]: string } | null = {};
let model = 'gpt-4'
let verbose = false


// HOW TO USE

// - dialogues file should be a list of dialogues separated by `---`
// - prompts file should have sections for each prompt
//   (e.g. `# getRelevantValue`, `# updateMoralFramework`, `# generateResponse` and `# Initial Values`)

// - run the following command to run the script
//   `node app/wise.ts dialogues.txt prompts.txt [evals.txt]`



// CODE

// This is the main function that takes a dialogue and a moral framework and returns a response.

async function wiseResponse(dialogue: string, values: string) {
  // ASSESS MORAL SITUATION
  const situation = await llm(prompts['situation'], dialogue, 'SITUATION');

  // FIND A RELEVANT VALUE
  let relevantValue = await getRelevantValue(values, situation);
  if (relevantValue.match(/^None/)) {
    values = await getUpdatedValues(values, situation)
    relevantValue = await getRelevantValue(values, situation);
  }
  if (relevantValue.match(/^None/)) throw new Error('Could not find relevant value')

  // GENERATE RESPONSE
  const response = await getResponse(relevantValue, dialogue)

  // RETURN IT
  return { response, relevantValue, situation }
}

// This is an alternative function that runs the evals for a dialogue and a moral framework.

async function runEvals(dialogue: string, values: string) {
  const baseResponse = await llm(prompts['baseResponse'], dialogue, 'BASE RESPONSE')
  const cleverResponse = await llm(prompts['cleverResponse'], dialogue, 'CLEVER PROMPT RESPONSE')
  const wisdom = await wiseResponse(dialogue, values)
  const considerations = wisdom.situation

  logEvaluation(dialogue, {
    'BASE RESPONSE': await evalResponse(`${dialogue}\n${baseResponse}`, considerations),
    'CLEVER RESPONSE': await evalResponse(`${dialogue}\n${cleverResponse}`, considerations),
    'WISE RESPONSE': await evalResponse(`${dialogue}\n${wisdom.response}`, considerations),
  })
}


// These are the functions that run the prompts.

async function getRelevantValue(values: string, situation: string) {
  return await llm(prompts['relevantValue'], pack({
    'ATTENTIONAL POLICIES': values,
    'MORAL AND AESTHETIC CONSIDERATIONS': situation,
  }), 'RELEVANT VALUE')
}

async function getUpdatedValues(values: string, situation: string) {
  return await llm(prompts['updateValues'], pack({
    'ATTENTIONAL POLICIES': values,
    'MORAL AND AESTHETIC CONSIDERATIONS': situation,
  }), 'UPDATED VALUES')
}

async function getResponse(value: string, dialogue: string) {
  return await llm(prompts['response'], pack({
    'ATTENTIONAL POLICY': value,
    'DIALOGUE': dialogue,
  }), 'RESPONSE')
}

async function evalResponse(completedDialogue: string, considerations: string) {
  return await llm(evals!['evalResponse'], pack({
    'COMPLETED DIALOGUE': completedDialogue,
    'CONSIDERATIONS': considerations,
  }), 'EVALUATION')
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

function logEvaluation(dialogue: string, responses: Record<string, string>) {
  log(chalk.bgBlueBright('EVALUATIONS'))
  log(chalk.blue(dialogue))
  for (const [key, value] of Object.entries(responses)) {
    log(chalk.blue(`${key}: ${value}`))
  }
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

  const fileContent = await fs.readFile(filePath, 'utf-8');
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



// RUN IT!

const args = await yargs(process.argv.slice(2)).boolean(['3', '4', 'v']).argv

if (args._.length < 2 || args._.length > 3) {
  console.error('Usage: node script.js <dialogues> <prompts> [<evals>]');
  process.exit(1);
}

if (args['3']) model = 'gpt-3.5-turbo'
if (args['4']) model = 'gpt-4'
if (args['v']) verbose = true

console.log('Using model', model)

const [dialoguesFile, promptsFile, evalsFile] = args._ as string[]

const dialogues = (await fs.readFile(dialoguesFile, 'utf-8')).split(/\r?\n---\r?\n/);
prompts = await loadFileAndSplitSections(promptsFile);
evals = evalsFile ? await loadFileAndSplitSections(evalsFile) : null

for (let dialogue of dialogues) {
  logDialogue(dialogue)
  if (!dialogue.match(/HUMAN/)) dialogue = `HUMAN: ${dialogue}\nBOT:`
  if (evals) await runEvals(dialogue, prompts['startingValues'])
  else await wiseResponse(dialogue, prompts['startingValues']);
}
