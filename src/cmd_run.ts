import { Context, DEFAULT_DIALOGUES, Flags } from "./context"
import { wiseResponse } from "./wisdom"
import chalk from 'chalk'
import { promises as fsp } from "fs"

export const command = 'run [dialoguesFile]'
export const describe = 'Run all dialogues in a dialogue file'

export function builder(yargs: any) {
  return yargs
    .positional('dialoguesFile', {
      type: 'string',
      description: 'Path to the dialogues file',
      default: DEFAULT_DIALOGUES,
    })
}

export async function handler(args: any) {
  const ctx = new Context(args as Flags & { dialoguesFile: string })
  const dialogues = (await fsp.readFile(args.dialoguesFile, 'utf-8')).split(/\r?\n---\r?\n/);
  const values = await ctx.getPrompt('starting-values')
  for (let dialogue of dialogues) {
    // wise response
    console.log(chalk.bgBlue('[CHECKING DIALOGUE]'))
    console.log(chalk.blue(dialogue))
    if (!dialogue.match(/HUMAN/)) dialogue = `HUMAN: ${dialogue}\nBOT:`
    await wiseResponse(ctx, dialogue, values)
  }
}