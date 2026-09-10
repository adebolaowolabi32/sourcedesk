import { writeFileSync, readFileSync } from "node:fs";
import { Engine } from "../server/engine.js";
import { dataset } from "../server/evaluation.js";
const engine = new Engine(); // Offline only: no config, model or database initialization.
const questions = [
  ...new Set([
    ...dataset.cases.map((c) => c.question),
    "Why is my payment still confirming?",
    "Can an admin approve their own payment?",
    "What happens after three temporary provider failures?",
    "How long does a recovery token last?",
  ]),
];
const answers = await Promise.all(questions.map((q) => engine.answer(q)));
const live = JSON.parse(
  readFileSync("docs/live-evaluation-report.json", "utf8"),
);
for (const result of live.results) {
  if (result.answer.status !== "answered") continue;
  const index = answers.findIndex((a) => a.question === result.question);
  if (index >= 0) answers[index] = result.answer;
  else answers.push(result.answer);
}
writeFileSync(
  "src/demo-fixtures.json",
  JSON.stringify(
    {
      documents: engine.corpus.documents,
      corpusVersion: engine.corpus.version,
      answers,
      evaluation: JSON.parse(
        readFileSync("docs/evaluation-report.json", "utf8"),
      ),
    },
    null,
    2,
  ) + "\n",
);
