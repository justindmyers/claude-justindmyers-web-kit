---
name: browser-verification
description: How to check a UI change in a real browser with the playwright-cli tool. Covers named sessions, reusing signed-in sessions, Chromium setup, console checks, and screenshot placement. Use before you open a browser to check, screenshot, or debug a UI.
---

Unit tests do not show runtime errors, layout problems, or hot module reload failures. Check UI changes in a real browser.

## Use playwright-cli

Drive the browser with `pnpm exec playwright-cli`. The `playwright-cli` skill lists the commands. The CLI writes snapshots to files, so it uses fewer tokens than a browser MCP. Open a named session in headed, persistent mode:

```bash
pnpm exec playwright-cli -s=<session> open http://localhost:<port> --headed --persistent
```

- Use a named session with `-s=<session>`. The persistent profile keeps sign-in state, so a user signs in once.
- Run `pnpm exec playwright-cli show` before you open a browser. It lists the live sessions on the machine. Reuse a session that is already signed in.
- Close each session you open: `pnpm exec playwright-cli -s=<session> close`.
- Prefix every command with `pnpm exec`. The tool is a dev dependency of the project. Do not install it globally.
- If the CLI reports that its skill file does not match the installed version, run `pnpm exec playwright-cli install --skills`. Do not edit the skill file by hand.
- If `open` fails because Chrome is not installed, run `pnpm exec playwright-cli install-browser chromium` once. Then add `--browser=chromium` to `open`.

## Check after the last edit

After your final edit, reload each page you changed with a hard reload. Read the console before you report the change as complete:

```bash
pnpm exec playwright-cli -s=<session> console
```

## Keep screenshots out of the working tree

- The CLI writes to `.playwright-cli/` by default. Check that `.gitignore` covers this directory. If you pass `--filename`, keep the file inside this directory.
- Write API dumps and screenshots from hand-written Playwright scripts to a scratch directory outside the project, or inside `.playwright-cli/`. Do not write them to a bare filename in the project root. API responses can contain private data.
- Delete the scratch files you create.
- Run `git status` before you report the change as finished. The tree should contain only source changes.
