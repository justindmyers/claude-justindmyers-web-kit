// Shared by every hook. Each plugin keeps an identical copy because plugins install separately.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative, resolve } from 'node:path';

const DEFAULTS = {
  sourceRoots: ['src/'],
  sharedLibrary: null,
  bannedImports: [],
  blockedCommands: [],
  allowedCssFiles: ['index.css', 'globals.css', 'theme.css'],
  a11yTestPattern: 'expectNoA11yViolations|toHaveNoViolations',
  themeTokenHint: 'Use a theme token from your Tailwind theme if one maps exactly.',
  prBody: {
    descriptionHeading: 'Description',
    stepsHeading: 'Validation Steps',
    maxBullets: 3,
    maxBulletChars: 200,
    maxSteps: 3,
    maxLines: 25
  },
  comments: { maxLineRun: 2, maxBlockLines: 3 }
};

export const loadConfig = (event = {}) => {
  const root = process.env.CLAUDE_PROJECT_DIR || event.cwd || process.cwd();
  let custom = {};
  try {
    custom = JSON.parse(readFileSync(join(root, '.claude', 'web-kit.json'), 'utf-8'));
  } catch {
    custom = {};
  }
  return {
    ...DEFAULTS,
    ...custom,
    prBody: { ...DEFAULTS.prBody, ...custom.prBody },
    comments: { ...DEFAULTS.comments, ...custom.comments },
    root
  };
};

export const inSourceRoots = (config, path) => {
  const rel = relative(config.root, resolve(path)).split('\\').join('/');
  return !rel.startsWith('..') && config.sourceRoots.some((prefix) => rel.startsWith(prefix));
};

export const matches = (pattern, text) => {
  try {
    return new RegExp(pattern).test(text);
  } catch {
    return false;
  }
};

export const readStdin = async () => {
  if (process.stdin.isTTY) {
    return '';
  }
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
};

export const changedLines = (path) => {
  let diff = '';
  try {
    diff = execFileSync('git', ['diff', '-U0', 'HEAD', '--', path], {
      cwd: dirname(path),
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
  } catch {
    return null;
  }

  if (!diff.trim()) {
    return null;
  }

  const lines = new Set();
  for (const match of diff.matchAll(/^@@ -\S+ \+(\d+)(?:,(\d+))? @@/gm)) {
    const start = Number(match[1]);
    const count = match[2] === undefined ? 1 : Number(match[2]);
    for (let line = start; line < start + count; line++) {
      lines.add(line);
    }
  }

  return lines;
};

export const scopeChecker = (scope) => (start, end = start) => {
  if (!scope) {
    return true;
  }
  for (let line = start; line <= end; line++) {
    if (scope.has(line)) {
      return true;
    }
  }
  return false;
};

export const report = ({ title, footer, empty }, found, toStdout) => {
  if (found.length === 0) {
    if (toStdout) {
      process.stdout.write(`${empty}\n`);
    }
    return;
  }

  const body = `Advisory (${title}):\n${found.map((line) => `- ${line}`).join('\n')}\n\n${footer}`;

  if (toStdout) {
    process.stdout.write(`${body}\n`);
    return;
  }

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: body }
    })
  );
};
