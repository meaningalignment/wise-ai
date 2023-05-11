# wise-ai

## Running

By default, you can run `wise-ai interact` to get an interactive prompt using the default wise ai prompts (in `default-prompts.md`). To use your own prompts, run `wise-ai interact -p <your-prompt-file>`.

`wise-ai run` will run through all the dialogues in the default `dialogues.txt` file (or `wise-ai run <your-dialogues-file>` to use your own.)

`wise-ai run -c -e` will compare wise ai responses with normal model responses, and run them both through our evaluation prompts.

Etc.

## About the files

 - Dialogues files should be a list of dialogues separated by `---`
 - Prompts files should have sections for each prompt
   (e.g. `# getRelevantValue`, `# updateMoralFramework`, `# generateResponse` and `# startingValues`)
