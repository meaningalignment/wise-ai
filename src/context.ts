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
  details: [string, string][] = []

  constructor(
    public readonly flags: Flags,
  ) {
    this.flags = flags;
    this.outputHeader()
  }

  model() {
    if (this.flags?.['3']) return 'gpt-3.5-turbo'
    else return DEFAULT_MODEL
  }


  // file access stuff

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


  // llm calling

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


  // logging

  outputHeader() {
    this.outputH1('Settings')
    this.outputText(`model: ${this.model()}`)
    const fields = ['promptsFile', 'personasFile', 'persona', 'dialoguesFile']
    fields.forEach((name) => {
      const value = (this.flags as any)[name]
      if (value) this.outputText(`${name}: ${value}`)
    })
    this.outputH1('Dialogue')
  }

  outputH1(text: string) {
    console.log(chalk.green((`\n# ${text}\n`)))
  }

  outputH2(text: string) {
    console.log(chalk.blue((`## ${text}\n`)))
  }

  outputText(text: string) {
    console.log(text)
  }

  outputRoleText(role: 'bot' | 'human', text: string) {
    if (role === 'bot') console.log(chalk.yellow(`BOT: ${text}`))
    else console.log(chalk.red(`HUMAN: ${text}`))
  }

  addDetail(name: string, value: string) {
    this.details.push([name, value])
  }

  outputDetails() {
    this.outputH1('Details')
    for (const [name, value] of this.details) {
      this.outputH2(name)
      this.outputText(value)
    }
  }

  logRequest(logAs: string, ...args: string[]) {
    if (this.flags?.verbose) {
      console.log(chalk.bgYellow(`[ISSUING REQUEST: ${logAs}]`))
      console.log(chalk.yellow(...args))
    }
  }

  logResponse(logAs: string, response: string) {
    if (this.flags?.verbose) {
      console.log(chalk.bgGreen(`[${logAs}]`))
      console.log(chalk.green(response))
    }
  }


  // json trace files & evaluations

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
