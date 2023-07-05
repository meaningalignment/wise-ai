import { promises as fsp } from 'fs'
import { Context, DEFAULT_DIALOGUES, Flags } from "./context"
import chalk from 'chalk'
import { pack } from './utils'
import { wiseResponse } from './wisdom'

type ResponseType = 'wise' | 'baseline' | 'clever' | 'joel'

export const command = 'battle <left> <right> [dialoguesFile]'
export const describe = 'Run a battle between two kinds of responses'

export function builder(yargs: any) {
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
}

async function getResponseOfType(ctx: Context, type: ResponseType, dialogue: string) {
  if (type === 'wise') {
    return (await wiseResponse(ctx, dialogue, await ctx.getPrompt('starting-values'))).response
  } else if (type === 'baseline') {
    return await ctx.prompt('base-response', dialogue)
  } else if (type === 'joel') {
    return await ctx.prompt('joel-response', dialogue)
  } else {
    return await ctx.prompt('clever-response', dialogue)
  }
}

export async function handler(args: any) {
  const ctx = new Context(args as Flags & { left: ResponseType, right: ResponseType, dialoguesFile: string })
  const dialogues = (await fsp.readFile(args.dialoguesFile, 'utf-8')).split(/\r?\n---\r?\n/);
  for (let dialogue of dialogues) {
    console.log(chalk.bgBlue('[CHECKING DIALOGUE]'))
    console.log(chalk.blue(dialogue))
    const leftResponse = await getResponseOfType(ctx, args.left, dialogue)
    const rightResponse = await getResponseOfType(ctx, args.right, dialogue)
    const output = await ctx.prompt('eval-battle', pack({
      'DIALOGUE': dialogue,
      'LEFT RESPONSE': leftResponse,
      'RIGHT RESPONSE': rightResponse,
    }))
    await ctx.trace('battle', dialogue, {
      leftModel: args.left,
      rightModel: args.right,
      leftResponse,
      rightResponse,
    }, output)
  }
}


