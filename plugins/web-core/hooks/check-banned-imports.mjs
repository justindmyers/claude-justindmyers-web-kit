#!/usr/bin/env node
// Advisory PostToolUse: warns when an edited file matches a `bannedImports` pattern. Never blocks.
import { readFileSync } from 'node:fs';
import { loadConfig, matches, readStdin } from './config.mjs';

const main = async () => {
  let event;
  try {
    event = JSON.parse(await readStdin());
  } catch {
    return;
  }

  const filePath = event?.tool_input?.file_path;
  if (!filePath || !/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath) || /\/\.claude\//.test(filePath)) {
    return;
  }

  const { bannedImports } = loadConfig(event);
  if (!bannedImports.length) {
    return;
  }

  let content = '';
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return;
  }

  const hits = bannedImports
    .filter((rule) => matches(rule.pattern, content))
    .map((rule) => `- ${rule.message}`);
  if (hits.length) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext: `Advisory (banned-imports check) for ${filePath}:\n${hits.join('\n')}`
        }
      })
    );
  }
};

main()
  .then(() => process.exit(0))
  .catch(() => process.exit(0));
