#!/usr/bin/env node
// Stop hook: asks once for a colocated a11y test on each new, uncommitted component file.
// Committed files are skipped, so a component that needs no test stops the reminder once it is committed.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { inSourceRoots, loadConfig, matches } from './config.mjs';

let input = {};
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0);
}
if (input.stop_hook_active) {
  process.exit(0);
}

const cwd = input.cwd ?? process.cwd();
const git = (...args) => {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return '';
  }
};

const root = git('rev-parse', '--show-toplevel');
if (!root) {
  process.exit(0);
}
const config = loadConfig({ cwd: root });
const added = [
  ...git('diff', '--name-only', '--diff-filter=A', 'HEAD').split('\n'),
  ...git('ls-files', '--others', '--exclude-standard').split('\n')
];

const isComponent = (file) =>
  /(?:^|\/)[A-Z][A-Za-z0-9]*\.tsx$/.test(file) &&
  !/\.(test|stories)\.tsx$/.test(file) &&
  inSourceRoots(config, path.join(root, file));

const missing = [...new Set(added)].filter(isComponent).filter((file) => {
  const test = path.join(root, file.replace(/\.tsx$/, '.test.tsx'));
  try {
    return !matches(config.a11yTestPattern, fs.readFileSync(test, 'utf-8'));
  } catch {
    return fs.existsSync(path.join(root, file));
  }
});

if (missing.length) {
  process.stdout.write(
    JSON.stringify({
      decision: 'block',
      reason:
        `New component file(s) with no colocated test that runs an a11y check (/${config.a11yTestPattern}/):\n- ${missing.join('\n- ')}\n` +
        'Add X.test.tsx next to each one (see the testing-conventions skill) and run it. ' +
        'If a file has no rendered UI of its own, say so to the user instead.'
    })
  );
}
process.exit(0);
