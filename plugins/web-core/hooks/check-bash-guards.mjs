#!/usr/bin/env node
// PreToolUse(Bash): blocks --no-verify and each `blockedCommands` pattern in .claude/web-kit.json.
import fs from 'node:fs';
import { loadConfig, matches } from './config.mjs';

let input = {};
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0);
}
const command = input.tool_input?.command ?? '';

const rules = [
  {
    pattern: '--no-verify\\b',
    message: 'Do not bypass git hooks. Fix the cause of the hook failure and run the command again.'
  },
  ...loadConfig(input).blockedCommands
];

const problems = rules.filter((rule) => matches(rule.pattern, command)).map((rule) => rule.message);
if (problems.length) {
  process.stderr.write(`Blocked by project rule:\n- ${problems.join('\n- ')}\n`);
  process.exit(2);
}
