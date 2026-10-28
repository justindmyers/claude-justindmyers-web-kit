#!/usr/bin/env node
// PreToolUse(Bash): blocks `gh pr create|edit` when the PR body goes past the `prBody` limits.
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './config.mjs';

let input = {};
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0);
}
const command = input.tool_input?.command ?? '';
if (!/(?:^|[;&|(]|\n)\s*gh\s+pr\s+(?:create|edit)\b/.test(command)) {
  process.exit(0);
}
const limits = loadConfig(input).prBody;

const bodyFile = command.match(/--body-file[= ]+("([^"]+)"|'([^']+)'|(\S+))/);
let body = command;
if (bodyFile) {
  const file = bodyFile[2] ?? bodyFile[3] ?? bodyFile[4];
  const resolved = path.resolve(input.cwd ?? process.cwd(), file.replace(/^~/, process.env.HOME));
  try {
    body = fs.readFileSync(resolved, 'utf8');
  } catch {
    body = command;
  }
} else if (!/--body\b|-b\s/.test(command)) {
  process.exit(0);
}

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const section = (name) => {
  const match = body.match(
    new RegExp(`##\\s*${escape(name)}[^\\n]*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, 'i')
  );
  return match ? match[1].split('\n').filter((l) => l.trim()) : [];
};

const problems = [];
const description = section(limits.descriptionHeading);
const bullets = description.filter((l) => /^\s*[-*]\s/.test(l));
if (bullets.length > limits.maxBullets) {
  problems.push(
    `${limits.descriptionHeading} has ${bullets.length} bullets (max ${limits.maxBullets}).`
  );
}
if (description.some((l) => !/^\s*[-*]\s/.test(l))) {
  problems.push(
    `${limits.descriptionHeading} must be one-line bullets only (no paragraphs, headings or code).`
  );
}
const longBullet = bullets.find((l) => l.length > limits.maxBulletChars);
if (longBullet) {
  problems.push(`A bullet is ${longBullet.length} chars (max ${limits.maxBulletChars}).`);
}
const steps = section(limits.stepsHeading).filter((l) => /^\s*(\d+[.)]|[-*])\s/.test(l));
if (steps.length > limits.maxSteps) {
  problems.push(`${limits.stepsHeading} has ${steps.length} items (max ${limits.maxSteps}).`);
}
if (/^\s*\|.*\|\s*$/m.test(body)) {
  problems.push('Body contains a table.');
}
if (/```/.test(body)) {
  problems.push('Body contains a code block.');
}
const bodyLines = body.split('\n').filter((l) => l.trim()).length;
if (bodyFile && bodyLines > limits.maxLines) {
  problems.push(`Body has ${bodyLines} non-empty lines (max ${limits.maxLines}).`);
}

if (problems.length) {
  process.stderr.write(
    `PR body too long. This project keeps PR descriptions short.\n- ${problems.join('\n- ')}\n` +
      `Rewrite: one-line bullets (problem, fix), at most ${limits.maxSteps} validation steps, no tables, code or evidence. ` +
      'Put investigation details in the chat reply instead.\n'
  );
  process.exit(2);
}
