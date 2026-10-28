---
name: testing-conventions
description: How to write and run vitest and React Testing Library tests for React UI. Covers react-aria-components jsdom traps (act with focus versus fireEvent.focus, value and onChange versus deprecated selection props, required provider wrapping), the axe helper, and fixture dates. Use when you add or fix component tests.
---

How to write and run tests for React UI with vitest, React Testing Library, and jsdom. The react-aria-components section lists traps that often break tests.

Read `.claude/web-kit.json` first. The `a11yTestPattern` field is a regex. A component test counts as an accessibility test when it contains a match. The default is `expectNoA11yViolations|toHaveNoViolations`.

## Running tests

- Run one or more test files with the one-shot test script in `package.json`. For example: `pnpm test:once path/to/Component.test.tsx`.
- Pass only the test files you changed. Get them from `git diff --name-only`. Do not pass a folder.
- Do not put `--` before the file paths. Vitest then ignores the paths and runs the full suite.
- For more than a few files, add `--maxWorkers=2`.
- Let CI run the full suite. Do not run it locally for a single change.
- Co-locate each test as `Name.test.tsx` next to `Name.tsx`.
- Run each test after you write it. Fix it until it passes. A test that never ran does not prove anything.

## Structure

- Import `describe`, `it`, `expect`, `vi`, and the hooks from `vitest` in each test file.
- To mock part of a module, keep the rest with `importActual`:

  ```ts
  vi.mock('./useThing', async (importActual) => ({
    ...(await importActual<typeof import('./useThing')>()),
    useThing: vi.fn(),
  }));
  ```

- `vi.mock` factories run before imports. A factory cannot read a top-level `const` or `let`. Create the value with `vi.hoisted`:

  ```ts
  const save = vi.hoisted(() => vi.fn());
  vi.mock('./api', () => ({ save }));
  ```

- A component that uses routing needs a router in the test. Use an in-memory router.
- Wrap the component in the providers it reads, such as a router, a query client, or a theme provider. If the project has a test-render helper that adds them, use that helper.
- To simulate a failing browser global, replace it with `vi.stubGlobal`. Restore it in `afterEach` with `vi.unstubAllGlobals()`.

## react-aria-components gotchas (jsdom)

- **Use `value`, `defaultValue`, and `onChange`.** Do not use `selectedKey`, `defaultSelectedKey`, or `onSelectionChange`. TypeScript flags these deprecated props. For single select, `value` is `Key | null`, and `onChange` receives `Key | null`. Apply this rule in components, not only in tests.

- **Open a ComboBox with `act(() => element.focus())`.** Do not use `fireEvent.focus`. `fireEvent.focus` dispatches `focus` but not `focusin`. React attaches `onFocus` to `focusin`, so the open-on-focus handler does not run. The native `focus()` method dispatches both events.

  ```ts
  act(() => {
    screen.getByRole('combobox').focus();
  });
  ```

- **A disabled react-aria `Button` inside a `Select` sets the native `disabled` attribute.** It does not set only `aria-disabled`. Assert with `expect(element).toBeDisabled()`.

- **Render context-dependent components with their provider.** A component that calls a context hook throws when no provider wraps it. The error names the missing provider. A shared test-render helper avoids this work.

## Accessibility in tests

Use the axe helper in every new UI component test. The helper runs axe-core on the rendered DOM and fails with a summary of each violation. Add it to the project once, in a small module such as `test/a11y.ts`:

```ts
import axe from 'axe-core';
import { expect } from 'vitest';

export async function expectNoA11yViolations(
  container: Element = document.body,
  options?: axe.RunOptions,
) {
  const results = await axe.run(container, options);
  const summary = results.violations
    .map((v) => `${v.id}: ${v.help} (${v.nodes.length} node(s))`)
    .join('\n');
  expect(results.violations, summary).toEqual([]);
}
```

Install `axe-core` as a dev dependency first. Then use the helper in a test:

```ts
const { container } = render(<MyComponent />);
await expectNoA11yViolations(container);
```

Do not mock axe. A mocked axe checks nothing. Use the `accessibility` skill for the rules that the helper checks.

## Prefer role and name queries

Query by accessible role and name, such as `getByRole` and `getByLabelText`. These queries also check that controls have names. Use `data-testid` only when no meaningful role exists.

## Fixture dates

A test that depends on the current date fails later, even when nothing changed in the code.

- Never assert on text that the component derives from the current time, such as "Today", "Yesterday", or "5 min ago".
- Fixed fixture dates are fine when no assertion checks how they display.
- When the output depends on the current time, pin the clock with `vi.setSystemTime`.
- Use neutral label values. A date-shaped literal used as a label can collide with date text that the component renders. Scoping the query hides the collision but leaves it in place. Remove the collision instead.
