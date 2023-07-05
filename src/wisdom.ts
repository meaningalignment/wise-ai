import { Context } from "./context";
import { pack } from "./utils";

async function getRelevantValue(ctx: Context, values: string, dialogue: string, situation: string) {
  return await ctx.prompt('relevant-value', pack({
    'ATTENTIONAL POLICIES': values,
    'CHALLENGING CHAT': dialogue,
    'WAYS IT COULD GO': situation,
  }))
}

async function getUpdatedValues(ctx: Context, values: string, dialogue: string, situation: string) {
  return await ctx.prompt('update-values', pack({
    'ATTENTIONAL POLICIES': values,
    'CHALLENGING CHAT': dialogue,
    'WAYS IT COULD GO': situation,
  }))
}

async function getResponse(ctx: Context, value: string, dialogue: string) {
  return await ctx.prompt('response', pack({
    'ATTENTIONAL POLICY': value,
    'DIALOGUE': dialogue,
  }))
}

export async function wiseResponse(ctx: Context, dialogue: string, values: string) {
  // ASSESS MORAL SITUATION
  const situation = await ctx.prompt('situation', dialogue);
  await ctx.trace('situation', dialogue, {}, situation)

  // FIND A RELEVANT VALUE
  let relevantValue = await getRelevantValue(ctx, values, dialogue, situation);
  if (relevantValue.match(/^None/)) {
    let previousValues = values;
    values = (await getUpdatedValues(ctx, values, dialogue, situation)).split('\n---\n').pop()!;
    await ctx.trace('upgrade', dialogue, { previousValues, situation }, values)
    relevantValue = await getRelevantValue(ctx, values, dialogue, situation);
  }
  if (relevantValue.match(/^None/)) throw new Error('Could not find relevant value')

  // GENERATE RESPONSE
  const response = await getResponse(ctx, relevantValue, dialogue)
  await ctx.trace('response', dialogue, { considerations: situation }, response)

  // RETURN IT
  return { response, relevantValue, situation, values }
}
