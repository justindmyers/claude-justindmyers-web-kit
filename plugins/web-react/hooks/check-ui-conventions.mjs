#!/usr/bin/env node
// Advisory PostToolUse UI-conventions check, scoped to lines changed vs HEAD. Never blocks.
// Whole-file audit: node check-ui-conventions.mjs --all <path>
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename, dirname } from 'node:path';
import {
  changedLines,
  inSourceRoots,
  loadConfig,
  readStdin,
  report,
  scopeChecker
} from './config.mjs';

const INTERACTIVE_TAG = /<(div|span|li|td|tr|p|img)\b((?:=>|[^>])*)>/g;

const lineRules = (config) => [
  {
    test: /\b(?:text|bg|border)-(?:slate|zinc|gray|neutral|white|black)(?:-\d+)?\b[^'"`]*\bdark:(?:text|bg|border)-/,
    message: `Manual light/dark color pair. ${config.themeTokenHint}`
  },
  {
    test: /\b(?:text|bg|border|fill|stroke|ring)-\[#[0-9a-fA-F]{3,8}\]/,
    message: `Arbitrary hex color class. ${config.themeTokenHint}`
  },
  {
    test: /\btabIndex=\{?\s*['"]?[1-9]/,
    message: '`tabIndex` greater than 0. Use 0 or -1 and fix the DOM order instead.'
  },
  {
    test: /\bhidden\s+\w+:table-cell\b/,
    message:
      'Hidden table column. Keep every column and let the table scroll inside its own container.'
  },
  {
    test: /eslint-disable(?:-next-line|-line)?\s+react-hooks\/exhaustive-deps/,
    message: 'Never disable `react-hooks/exhaustive-deps`. Fix the dependency. See the code-style skill.'
  }
];

const isUiSource = (config, path) =>
  /\.(tsx|jsx)$/.test(path) &&
  inSourceRoots(config, path) &&
  !/\.(test|stories)\.(tsx|jsx)$/.test(path);

const isUntracked = (path) => {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', basename(path)], {
      cwd: dirname(path),
      stdio: 'ignore'
    });
    return false;
  } catch {
    return true;
  }
};

const lineAt = (source, index) => source.slice(0, index).split('\n').length;

const findings = (config, path, source, wholeFile = false) => {
  const inScope = scopeChecker(wholeFile ? null : changedLines(path));
  const rules = lineRules(config);
  const found = [];

  source.split('\n').forEach((text, index) => {
    if (!inScope(index + 1)) {
      return;
    }
    for (const rule of rules) {
      if (rule.test.test(text)) {
        found.push(`${path}:${index + 1} — ${rule.message}`);
      }
    }
  });

  for (const match of source.matchAll(INTERACTIVE_TAG)) {
    const [tag, name, attrs] = match;
    const start = lineAt(source, match.index);
    if (!inScope(start, start + tag.split('\n').length - 1)) {
      continue;
    }
    if (name === 'img' && !/\balt=/.test(attrs)) {
      found.push(
        `${path}:${start} — \`<img>\` without \`alt\`. Use \`alt=""\` when the image is decorative.`
      );
    }
    if (
      name !== 'img' &&
      /\bon(?:Click|KeyDown|MouseDown)=/.test(attrs) &&
      !/\brole=/.test(attrs)
    ) {
      found.push(
        `${path}:${start} — \`<${name}>\` with a click handler. Use a real \`<button>\` or a react-aria \`Button\` so it is keyboard-operable and named.`
      );
    }
  }

  const components = [
    ...source.matchAll(/^(?:export\s+)?(?:const|function)\s+([A-Z][a-zA-Z0-9]*)\b/gm)
  ].filter(([, name]) => name !== name.toUpperCase() && !name.endsWith('Context'));
  if (components.length > 1 && components.some((match) => inScope(lineAt(source, match.index)))) {
    found.push(
      `${path} — ${components.length} PascalCase declarations (${components.map(([, name]) => name).join(', ')}). One React component per file. Move sub-components to sibling files.`
    );
  }

  return found;
};

const REPORT = {
  title: 'UI-conventions check',
  empty: 'No UI-convention findings.',
  footer:
    'See the code-style and accessibility skills. Ignore a finding only when it is a false positive.'
};

const main = async () => {
  const auditIndex = process.argv.indexOf('--all');

  if (auditIndex !== -1) {
    const config = loadConfig();
    for (const path of process.argv.slice(auditIndex + 1)) {
      if (isUiSource(config, path)) {
        report(REPORT, findings(config, path, readFileSync(path, 'utf-8'), true), true);
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
  if (!path) {
    return;
  }
  const config = loadConfig(event);

  if (
    path.endsWith('.css') &&
    inSourceRoots(config, path) &&
    !config.allowedCssFiles.includes(basename(path)) &&
    isUntracked(path)
  ) {
    report(
      REPORT,
      [
        `${path} — new CSS file. Use Tailwind utility classes in JSX. Only theme variables, @import and keyframes live in CSS.`
      ],
      false
    );
    return;
  }

  if (!isUiSource(config, path)) {
    return;
  }

  let source = '';
  try {
    source = readFileSync(path, 'utf-8');
  } catch {
    return;
  }

  report(REPORT, findings(config, path, source), false);
};

main()
  .then(() => process.exit(0))
  .catch(() => process.exit(0));
