#!/usr/bin/env node
// Advisory PostToolUse: warns on long comments added by the current diff. Never blocks.
// Whole-file audit: node check-comment-bloat.mjs --all <path>
import { readFileSync } from 'node:fs';
import { changedLines, loadConfig, readStdin, report, scopeChecker } from './config.mjs';

const isCode = (path) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(path);

const commentRuns = (lines) => {
  const runs = [];
  let run = null;

  lines.forEach((text, index) => {
    const lineNumber = index + 1;

    if (text.trim().startsWith('//')) {
      run = run ?? { start: lineNumber, end: lineNumber, length: 0 };
      run.end = lineNumber;
      run.length += 1;
      return;
    }

    if (run) {
      runs.push(run);
      run = null;
    }
  });

  if (run) {
    runs.push(run);
  }

  return runs;
};

const blockComments = (lines) => {
  const blocks = [];
  let block = null;

  lines.forEach((text, index) => {
    const trimmed = text.trim();
    const lineNumber = index + 1;

    if (!block && trimmed.startsWith('/*')) {
      block = { start: lineNumber, end: lineNumber };
    }

    if (block) {
      block.end = lineNumber;
      if (trimmed.includes('*/')) {
        blocks.push(block);
        block = null;
      }
    }
  });

  return blocks;
};

const findings = (path, source, limits, wholeFile = false) => {
  const lines = source.split('\n');
  const inScope = scopeChecker(wholeFile ? null : changedLines(path));
  const found = [];
  const runs = commentRuns(lines);
  const blocks = blockComments(lines);

  for (const run of runs) {
    if (run.length > limits.maxLineRun && inScope(run.start, run.end)) {
      found.push(
        `${path}:${run.start} — ${run.length}-line \`//\` comment (max ${limits.maxLineRun}). Keep the fact that the code does not show. Cut the narration.`
      );
    }
  }

  for (const block of blocks) {
    const length = block.end - block.start + 1;
    if (length > limits.maxBlockLines && inScope(block.start, block.end)) {
      found.push(
        `${path}:${block.start} — ${length}-line block comment (max ${limits.maxBlockLines}). If it needs this much prose, the design is probably too complex.`
      );
    }
  }

  if (path.endsWith('.tsx')) {
    const comments = [...runs, ...blocks];
    lines.forEach((text, index) => {
      // PascalCase only: SCREAMING_SNAKE exports are constants, not components.
      const name = text.match(/^export (?:const|function) ([A-Z][a-zA-Z0-9]*)\b/)?.[1];
      if (!name || name === name.toUpperCase()) {
        return;
      }

      const preceding = comments.find((comment) => comment.end === index);
      if (preceding && inScope(preceding.start, index + 1)) {
        found.push(
          `${path}:${preceding.start} — doc comment above the top-level component \`${name}\`. Move any real constraint inline to the line it constrains.`
        );
      }
    });
  }

  return found;
};

const REPORT = {
  title: 'comment-bloat check',
  empty: 'No comment-bloat findings.',
  footer:
    'Default to no comment. Only a non-obvious WHY earns one. See the code-style skill (web-react plugin).'
};

const main = async () => {
  const auditIndex = process.argv.indexOf('--all');

  if (auditIndex !== -1) {
    const { comments } = loadConfig();
    for (const path of process.argv.slice(auditIndex + 1)) {
      if (isCode(path)) {
        report(REPORT, findings(path, readFileSync(path, 'utf-8'), comments, true), true);
      }
    }
    return;
  }

  let event;
  try {
    event = JSON.parse(await readStdin());
  } catch {
    return;
  }

  const path = event?.tool_input?.file_path;
  if (!path || !isCode(path)) {
    return;
  }

  let source = '';
  try {
    source = readFileSync(path, 'utf-8');
  } catch {
    return;
  }

  report(REPORT, findings(path, source, loadConfig(event).comments), false);
};

main()
  .then(() => process.exit(0))
  .catch(() => process.exit(0));
