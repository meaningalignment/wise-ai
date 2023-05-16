# wise-ai

## Installation

```sh
npm i
./wise-ai -h
```

## Running

By default, you can run `wise-ai interact` to get an interactive prompt using the default wise ai prompts (in `default-prompts.md`). To use your own prompts, run `wise-ai interact -p <your-prompt-file>`.

`wise-ai run` will run through all the dialogues in the default `dialogues.txt` file (or `wise-ai run <your-dialogues-file>` to use your own.)

`wise-ai run -e` or `wise-ai interact -e` will run auto-evals for subtasks. Currently only one such eval is implemented, "eval-situation", which assesses whether the model is good at recognizing moral aspects of a situation.

`wise-ai battle baseline wise` will run the dialogues comparing baseline responses and wise ones, and evaluating which response seems wiser.

For more command line options, run `wise-ai -h` and `wise-ai interact|run|battle -h`


## About the files

* Check out `dialogues.txt` for the default list of dialogues the program runs through. The file is a list of dialogues separated by `---`. You can provide your own dialogues file as a command line argument to `wise-ai run` or `wise-ai battle`.

* Check out `default-prompts.md` for the default prompts used to generate wise responses and to do evaluations. Prompt files have sections for each prompt.
   (e.g. `# situation`, `# starting-values`, `# response` and `# eval-response`). You can use your own prompts by copying the file, changing it, and passing your file in with `wise-ai <command> -p <your-prompt-file>`.
