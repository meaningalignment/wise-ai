import { default as fs, promises as fsp } from 'fs'
import { Configuration, OpenAIApi } from "openai"
import dotenv from 'dotenv'
import chalk from 'chalk'
import { pack } from './utils';

dotenv.config();
const openai = new OpenAIApi(new Configuration({ apiKey: process.env.OPENAI_API_KEY }));

export const DEFAULT_DIALOGUES = './data/dialogues.txt'
const DEFAULT_MODEL = 'gpt-4'

export interface Flags {
  3: boolean,
  verbose: boolean,
  runEvals: boolean,
  promptsFile: string,
  personasFile: string,
  traceFile: string,
}

interface Trace {
  eventType: 'response' | 'situation' | 'upgrade' | 'battle',
  model: 'gpt-3.5-turbo' | 'gpt-4',
  dialogue: string,
  parameters: Record<string, string>
  output: string,
  evaluation?: string,
}

export class Context {
  prompts: { [prompt: string]: string } | null = null
  personas: { [persona: string]: string } | null = null

  constructor(
    public readonly flags: Flags,
  ) {
    this.flags = flags;
    console.log('Using model', this.model())
  }

  model() {
    if (this.flags?.['3']) return 'gpt-3.5-turbo'
    else return DEFAULT_MODEL
  }

  async getPrompt(name: string) {
    if (!this.prompts) this.prompts = await loadFileAndSplitSections(this.flags?.['promptsFile']!)
    if (!this.prompts[name]) throw new Error(`No prompt named ${name}`)
    return this.prompts[name]
  }

  async getPersona(name: string) {
    if (!this.personas) this.personas = await loadFileAndSplitSections(this.flags?.['personasFile']!)
    if (!this.personas[name]) throw new Error(`No persona named ${name}`)
    return this.personas[name]
  }

  async prompt(name: string, userPrompt: string) {
    const p = await this.getPrompt(name)
    return this.llm(p, userPrompt, name)
  }

  async llm(systemPrompt: string, userPrompt: string, logAs: string) {
    this.logRequest(logAs, systemPrompt, userPrompt)
    //console.log(chalk.yellow(systemPrompt))
    const completion = await openai.createChatCompletion({
      model: this.model(),
      messages: [
        { content: systemPrompt, role: "system" },
        { content: userPrompt, role: "user" }
      ],
      max_tokens: 2000,
    });
    const result = completion.data.choices[0].message?.content as string
    this.logResponse(logAs, result)
    return result;
  }

  logRequest(logAs: string, ...args: string[]) {
    if (!this.flags?.verbose) console.log(chalk.bgGreen(`[${logAs}]`))
    if (this.flags?.verbose) {
      console.log(chalk.bgYellow(`[ISSUING REQUEST: ${logAs}]`))
      console.log(chalk.yellow(...args))
    }
  }

  logResponse(logAs: string, response: string) {
    if (this.flags?.verbose) console.log(chalk.bgGreen(`[${logAs}]`))
    console.log(chalk.green(response))
  }

  async trace(eventType: Trace['eventType'], dialogue: string, parameters: Record<string, string>, output: string) {
    if (!this.flags?.traceFile) return
    const t: Trace = { eventType, model: this.model(), dialogue, parameters, output }
    if (this.flags?.runEvals) {
      const promptName = `eval-${t.eventType}`
      const evalPrompt = await this.getPrompt(promptName)
      if (evalPrompt) {
        t.evaluation = await this.prompt(promptName, pack({
          'TASK': t.dialogue,
          'SUBMISSION': t.output,
        }))
      }
    }
    if (!fs.existsSync('./outputs')) fs.mkdirSync('./outputs')
    fs.appendFileSync(this.flags?.traceFile, JSON.stringify(t) + '\n')
  }

}

export async function loadFileAndSplitSections(filePath: string) {
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
