#!/usr/bin/env node
// PreToolUse(Agent): runs Explore on Haiku unless the caller picks a model. Keeps the built-in Explore prompt.
import fs from 'node:fs';

let input = {};
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0);
}
const toolInput = input.tool_input ?? {};
if (toolInput.subagent_type !== 'Explore' || toolInput.model) {
  process.exit(0);
}

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      updatedInput: { ...toolInput, model: 'haiku' }
    }
  })
);
