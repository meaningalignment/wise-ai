export function pack(contents: Record<string, string>) {
  return Object.entries(contents).map(([key, value]) => `--- ${key} ---\n\n${value} \n`).join('\n')
}
