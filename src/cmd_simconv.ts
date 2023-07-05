import chalk from 'chalk'
import { Context, Flags } from './context'
import { wiseResponse } from './wisdom'

export const command = 'simconv <persona>'
export const describe = 'Simulate a conversation'
export const builder = (yargs: any) => {
  return yargs
    .positional('persona', {
      type: 'string',
      description: 'Persona to use from personas.md',
      demandOption: true,
      // default: DEFAULT_PERSONA,
    })
}
export async function handler(args: any) {
  const context = new Context(args as Flags & { persona: string })
  let dialogue = 'HUMAN: '
  let values = await context.getPrompt('starting-values')
  for (let i = 0; i < 2; i++) {
    const p = await context.getPersona(args.persona)
    let line = context.llm(p, dialogue, `persona-${args.persona}`)
    if (dialogue) dialogue += `\n`
    dialogue += `${line}\nBOT: `
    const response = await wiseResponse(context, dialogue, values)
    values = response.values
    dialogue += `${response.response}\nHUMAN: `
    console.log(chalk.blue(dialogue))
  }
}
