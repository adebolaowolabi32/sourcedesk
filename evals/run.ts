import { writeFile } from "node:fs/promises";
import { evaluate } from "../server/evaluation.js";
const report = await evaluate();
await writeFile(
  "docs/evaluation-report.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    { ...report, results: report.results.filter((r) => !r.passed) },
    null,
    2,
  ),
);
