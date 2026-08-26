#!/usr/bin/env node
/**
 * Regression tests for issue #323: a `--write` run curled the quotes inside
 * bare ESM imports in src/stories/*.mdx, which broke the modules.
 *
 * No test framework in this repo, so this is a plain node script:
 *   node packages/smart-quotes/test/mdx-imports.test.js
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const CLI = path.join(__dirname, "..", "cli.js");
let failures = 0;

function check(name, fileName, input, expected) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "smart-quotes-"));
  const file = path.join(dir, fileName);
  fs.writeFileSync(file, input);
  execFileSync(process.execPath, [CLI, "--write", "--paths", dir], { stdio: "pipe" });
  const actual = fs.readFileSync(file, "utf8");
  fs.rmSync(dir, { recursive: true, force: true });

  if (actual === expected) {
    console.log(`  ok   ${name}`);
    return;
  }
  failures += 1;
  console.log(`  FAIL ${name}`);
  console.log(`       expected: ${JSON.stringify(expected)}`);
  console.log(`       actual:   ${JSON.stringify(actual)}`);
}

console.log("mdx imports:");

// The exact shape that broke: a bare, unfenced import at the top of an .mdx file.
check(
  "bare mdx import keeps straight quotes",
  "Doc.mdx",
  "import { Meta, Typeset } from '@storybook/blocks';\n\nHe said 'hello' to the room.\n",
  "import { Meta, Typeset } from '@storybook/blocks';\n\nHe said ‘hello’ to the room.\n"
);

check(
  "multi-line mdx import keeps straight quotes",
  "Doc.mdx",
  "import {\n  Meta,\n  Title,\n} from '@storybook/blocks';\n\nProse with 'quotes'.\n",
  "import {\n  Meta,\n  Title,\n} from '@storybook/blocks';\n\nProse with ‘quotes’.\n"
);

check(
  "mdx export statement keeps straight quotes",
  "Doc.mdx",
  "export const meta = { title: 'Tokens' };\n\nProse with 'quotes'.\n",
  "export const meta = { title: 'Tokens' };\n\nProse with ‘quotes’.\n"
);

// .md must keep its old behaviour: an `import` line there is prose, not code.
check(
  "md import line is still treated as prose",
  "doc.md",
  "import { Meta } from '@storybook/blocks';\n",
  "import { Meta } from ‘@storybook/blocks’;\n"
);

// The pre-existing fence protection must still hold in .mdx.
check(
  "fenced code in mdx still protected",
  "Doc.mdx",
  "Prose 'here'.\n\n```js\nconst a = 'x';\n```\n",
  "Prose ‘here’.\n\n```js\nconst a = 'x';\n```\n"
);

// A word that merely starts with "import" must not trigger the guard.
check(
  "prose starting with 'important' is still curled",
  "Doc.mdx",
  "important 'thing' here\n",
  "important ‘thing’ here\n"
);

console.log(failures === 0 ? "\nall passed" : `\n${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
