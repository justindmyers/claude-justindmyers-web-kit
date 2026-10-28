# claude-justindmyers-web-kit

A base Claude Code setup for React, TypeScript and Tailwind projects. The kit has two plugins and a project template.

## Plugins

### web-core

These hooks work with any stack.

- **set-explore-model** runs the built-in Explore agent on Haiku. A call that sets a model keeps its model.
- **check-bash-guards** blocks `--no-verify` and each `blockedCommands` pattern.
- **check-pr-body** blocks a `gh pr create` or `gh pr edit` call when the PR body goes past the `prBody` limits.
- **check-comment-bloat** warns when an edit adds a long comment. It checks only the lines that the current diff changes.
- **check-banned-imports** warns when an edited file matches a `bannedImports` pattern.

### web-react

- Skills: `code-style`, `react-patterns`, `atoms-vs-state`, `accessibility`, `testing-conventions` and `browser-verification`.
- Agents: `a11y-reviewer` and `reuse-auditor`. Both agents only read and report.
- Command: `/new-component` makes a component, a colocated test and a story.
- Hook **check-ui-conventions** warns about these problems in the lines that an edit changes:
  - manual light/dark color pairs and raw hex colors
  - a `tabIndex` above 0, a `div` with a click handler, and an `img` with no `alt`
  - hidden table columns and an `exhaustive-deps` disable
  - more than one component in a file
- Hook **check-new-component-tests** runs when Claude stops. It asks for a colocated a11y test for each new component that is not committed.

The warning hooks never block. The blocking hooks exit with code 2 and tell Claude the reason.

## Use the kit in a project

1. Copy the `template/` folder into the project root.
2. Edit `CLAUDE.md`. Replace each `<...>` placeholder.
3. Edit `.claude/web-kit.json` for the project. See [Configuration](#configuration).
4. Start Claude Code in the project. Accept the prompt to trust the marketplace and install the two plugins.

To install the plugins by hand:

```text
/plugin marketplace add justindmyers/claude-justindmyers-web-kit
/plugin install web-core@justindmyers-web-kit
/plugin install web-react@justindmyers-web-kit
```

## Configuration

The hooks read `.claude/web-kit.json` in the project root. Each key is optional.

| Key | Default | Use |
|---|---|---|
| `sourceRoots` | `["src/"]` | Folders that the UI hooks check. |
| `sharedLibrary` | `null` | The path of the shared library. The `reuse-auditor` agent searches it. |
| `bannedImports` | `[]` | A list of `{ "pattern", "message" }`. The pattern is a regular expression. |
| `blockedCommands` | `[]` | A list of `{ "pattern", "message" }` for Bash commands. |
| `allowedCssFiles` | `["index.css", "globals.css", "theme.css"]` | CSS file names that can be new. |
| `a11yTestPattern` | `expectNoA11yViolations\|toHaveNoViolations` | The text that a component test must contain. |
| `themeTokenHint` | A general hint | The text that the color warnings show. |
| `prBody` | 3 bullets, 200 chars, 3 steps, 25 lines | Headings and limits for PR bodies. |
| `comments` | `maxLineRun: 2`, `maxBlockLines: 3` | Comment length limits. |

## Subagent models

Do not set `CLAUDE_CODE_SUBAGENT_MODEL`. That variable does not change Explore, because Explore inherits the main model. It also moves every other subagent to the same model. The `set-explore-model` hook changes only Explore.

## Tests

```bash
npm test
```

The tests run each hook as a child process in a temporary git repository. CI runs them on each push and pull request.

## License

MIT
