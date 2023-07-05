import { Context, Flags } from "./context"
import { wiseResponse } from "./wisdom"
import { createInterface } from 'readline'

export const command = 'interact'
export const describe = 'Interact with the system'

export async function handler(args: any) {
  const ctx = new Context(args as Flags)
  let dialogue = ''
  let values = await ctx.getPrompt('starting-values')
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
    const response = await wiseResponse(ctx, dialogue, values)
    ctx.outputRoleText('bot', response.response)
    values = response.values
    dialogue += `\nBOT: ${response.response}`
    rl.prompt()
  })
  rl.on('close', () => {
    ctx.outputDetails()
    process.exit(0);
  })
}
