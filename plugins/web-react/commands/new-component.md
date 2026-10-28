---
description: Scaffold a new React component with a shared-first check, a colocated test (including an accessibility assertion), and a story for UI components.
argument-hint: <ComponentName> [target dir]
---

Scaffold a new React component. Argument: `$ARGUMENTS` (component name, optionally followed by a target directory).

Read `.claude/web-kit.json` first. Use `sharedLibrary` for the shared folder and `a11yTestPattern` for the accessibility test pattern.

Before you generate anything:

1. **Check the shared library first.** Search `sharedLibrary` for a component that already does this. If one exists, stop and tell the user to reuse it. Scaffold only when no equivalent exists. If `sharedLibrary` is absent, skip this check and say so.
2. **Decide placement.** A generic component, such as a primitive or a reusable pattern, belongs in `sharedLibrary`. Ask the user if the placement is unclear. Otherwise use the target directory from the argument. If the argument gives no directory, infer the feature folder and ask the user to approve it.
3. **Read a sibling.** Read a nearby component, its test, and its story, if any. Match the local import style, prop patterns, and class-name helper.

Then generate the files, following the `accessibility` and `testing-conventions` skills:

- **`<ComponentName>.tsx`.** Export exactly one component per file. Type props with an interface. Use the Tailwind utility classes that the project already uses. Use curly braces for every control-flow body. Put a blank line between adjacent multiline JSX blocks. Extract each sub-component into its own sibling file. For interactive elements, use react-aria-components components where possible. Give every interactive control an accessible name.
- **`<ComponentName>.test.tsx`.** Put the test next to the component. Render with the providers the component needs. Query by role and name. Cover the main states. Include an accessibility assertion:

  ```ts
  import { expectNoA11yViolations } from './test/a11y';
  // ...
  it('has no accessibility violations', async () => {
    const { container } = render(<MyComponent />);
    await expectNoA11yViolations(container);
  });
  ```

  Then run the one-shot test script on the new file, such as `pnpm test:once <path>`. Fix failures until the test passes. Do not return an unrun test.
- **`<ComponentName>.stories.tsx`.** Add this file only for a presentational UI component, and only if the project uses Storybook. Match the local story format. Include a title, the component, a description, and representative stories. Skip this file for a logic-only or container component.

Finally, run the project typecheck and lint scripts on the new files. Fix every issue they report. Report the files you created and the results of each command.
