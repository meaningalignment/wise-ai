# wise-ai

A "Wise AI", as defined here, is an AI system with at least these two features:

1. **It “struggles” with the moral situations it finds itself in.** It can comprehend the moral significance of the situations it encounters, and learn from these scenarios, recognizing new moral implications by observing and guessing at outcomes and possibilities. And it can use these moral learnings to revise internal policies (values) that guide its decision-making processes.
2. **It uses “human-compatible” reasons and values.** It recognizes as good the same kinds of things we broadly recognize as good, plus possibly more sophisticated things we cannot yet recognize as good. It can articulate its values and how they influenced its decisions, in a way humans can comprehend.

Additionally, we sometimes add a third or fourth feature:

- **It understands the breadth of human wisdom.** It knows the {virtue, environment} pairs which make human life meaningful and workable — the sources of meaning behind broad social activities (like science, democracy, education, leadership, and love) — so it can operate using the best values it can surface from the population it serves.
- **It honors what is noble and great in human life (and perhaps, beyond), and considers itself a steward of that universe of meaning.** As a consequence, it understands and supports what's meaningful to individual users, and works to help users with that (rather than just driving engagement).

## Wise reponse evals

One focus in this repo is assessing these capabilities in existing LLMs.

You can run `wise-ai battle` which will compare two ways to respond to various moral situations against one another, and auto-eval which response is wiser. (See `eval-response` in `default-prompts.md` for the comparison prompt, and the list of moral scenarios in `dialogues.txt`.)

## Wise AI Prototype

This repo also includes a toy prototype of a "Wise AI", built as a prompt chain for GPT-4. This prototype uses step-by-step moral reasoning (implemented in fn `wiseResponse` in `wise-ai.ts`) to achieve the above:

- First, it identifies the moral considerations of its current situation.
- Then, it considers its current policies and decides whether they address those moral considerations.
- Finally, it updates its policies if necessary, and uses them to guide its response.

We've found that this yields a significantly wiser chatbot, compared to normal chatgpt responses. (Run `wise-ai interact` or `wise-ai battle baseline wise` to see for yourself).

This prototype already exhibits three advantages over current chatbots:

1. Our prototype grapples with its moral situation, and tries to live up to it.
2. It learns morally (only in `wise-ai interact` mode), and could develop values that aren't programmed into it, as it faces more and more complicated situations.
3. As it interact with a human, it comes from a point of view that humans can understand. The user can track what its concerned about. It feels more like engaging with an interpretable entity.

(It would be fascinating to see a model fine-tuned based on the responses of such a Wise AI. Even better would be a model that not only answers based on its values, but also attaches these values to its responses, or makes them inspectable.)

## Moral reasoning subtask evals

We are also working on evaluations for the step-by-step moral reasoning listed above. For instance, see `eval-situation` in `default-prompts.md` which uses GPT4 to evaluate how well GPT-4 can recognize the moral significance of a chat situation. You can run these subtask evals by passing `-e` to a relevant subcommand, such as `wise-ai interact -e`.

## Results so far

We believe our Wise AI evaluation suite already shows limits of existing models.GPT4, as prompted here, shows a good understanding of morally significant situations, but generally does not respond appropriately to these situations.Current models demonstrate a rich understanding of human values, but struggle to apply those values in their responses.

Ultimately, we expect the models that will ace the suite will be trained with new methods and data sets, focused on moral reasoning in various situations. We also hope for models with new architectures that can explicitly encode their values, and recognize (as humans do) whether they're adhering to them, or are on shaky ground.


## Installation

First run `npm install` or `yarn` or whatever.

Then add a file called `.env` with your open AI key in it

```sh
OPENAI_API_KEY=sk-ajshdkjsahakd9a78s9d79daskjdhaksd87askjdhkasd878
```

Try running the wise-ai command.

```sh
./wise-ai -h
```

## Command line usage

By default, you can run `wise-ai interact` to get an interactive prompt using the default wise ai prompts (in `default-prompts.md`). To use your own prompts, run `wise-ai interact -p <your-prompt-file>`.

`wise-ai run` will run through all the dialogues in the default `dialogues.txt` file (or `wise-ai run <your-dialogues-file>` to use your own.)

`wise-ai run -e` or `wise-ai interact -e` will run auto-evals for subtasks. Currently only one such eval is implemented, "eval-situation", which assesses whether the model is good at recognizing moral aspects of a situation.

`wise-ai battle baseline wise` will run the dialogues comparing baseline responses and wise ones, and evaluating which response seems wiser.

For more command line options, run `wise-ai -h` and `wise-ai interact|run|battle -h`


## Upgrading the dialogues and prompts

* `dialogues.txt` contains the default list of dialogues the program runs through. The file is a list of dialogues separated by `---`. You can provide your own dialogues file as a command line argument to `wise-ai run` or `wise-ai battle`.

* `default-prompts.md` contains the default prompts used to generate wise responses and do evaluations. Prompt files have sections for each prompt.
   (e.g. `# situation`, `# starting-values`, `# response` and `# eval-response`). You can use your own prompts by copying the file, changing it, and passing your file in with `wise-ai <command> -p <your-prompt-file>`.


## Roadmap

- Only one subtask eval has been implemented. `update-values` needs an eval or two, as does `respond`
- Things could be better documented.

# Further reading

The theory of moral learning we use is documented here: https://www.notion.so/humsys/Human-Moral-Learning-c502faf14a0c4cf1be786cc506be271a?pvs=4

More info on Wise AI here: https://www.notion.so/humsys/Wise-AI-f132fda49fa941c990a57e527945729e?pvs=4
