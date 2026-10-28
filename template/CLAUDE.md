# <project-name>

<One sentence: what this project is and who uses it.>

## Layout

- `src/` — application source. <Replace with the real layout. Name the shared library, if any.>

## Commands

- `pnpm dev` — start the app.
- `pnpm test` — run the tests once.
- `pnpm lint` / `pnpm lint:fix` — run eslint.
- `pnpm typecheck` — run `tsc --noEmit`.

## Rules most tasks need

- **Reuse before you write.** Search the shared library and the existing components before you add a helper, hook or component.
- **Tailwind utility classes only in JSX.** Do not write new CSS rules. Use theme tokens before raw colors.
- **One React component per file.** Put sub-components in sibling files.
- **Curly braces on every control-flow body.**
- **No comments by default.** A comment explains a non-obvious WHY in at most two lines.
- **Never suppress `react-hooks/exhaustive-deps`.** Fix the dependency.
- **Accessible by default.** Every control is keyboard-operable and has an accessible name. See the `accessibility` skill.
- **Test what you write, then run it.** Each new component gets a colocated test with an axe check. See the `testing-conventions` skill.
- **Commit, push or open a PR only when asked.**

## Scratch output

Screenshots, API dumps and other scratch output go in an ignored folder, never in the working tree. Check `git status` before you report a change as done.

## Agent tooling

The `web-core` and `web-react` plugins supply the hooks, skills, agents and commands. `.claude/web-kit.json` configures them for this project.
