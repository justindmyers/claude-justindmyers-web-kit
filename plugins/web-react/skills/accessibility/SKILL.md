---
name: accessibility
description: Accessibility rules for React UI work. Covers semantic roles, keyboard operability, accessible names, focus management for overlays, contrast, and correct use of react-aria-components. Use when you build or review interactive UI, custom controls, overlays, forms, or icon-only controls.
---

Accessibility rules for React UI work, and how to test them.

Read `.claude/web-kit.json` first. The `sharedLibrary` field names the project shared folder, if the project has one. The `bannedImports` field lists libraries the project replaces.

Two layers check accessibility. The first layer is the rules below and the `a11y-reviewer` agent. The second layer runs automated axe checks in tests. Some lint configs disable `jsx-a11y/alt-text`. If yours does, check `alt` text by hand.

## Build on react-aria-components

react-aria-components provides correct roles, keyboard behavior, and focus management. For interactive UI, prefer this order:

1. A component from `sharedLibrary` that wraps react-aria-components.
2. A react-aria-components primitive, such as `Button`, `Dialog`, `Tooltip`, `Disclosure`, `Select`, or `ComboBox`.
3. A native `<button>` or `<a>`.

Avoid a `<div onClick>`. A native element or a react-aria component is almost always the right choice.

If `bannedImports` lists a library, do not add new imports of it. Follow the `message` text for that entry.

## Non-negotiables

- **Keyboard operability.** Every interactive element is reachable with the Tab key. Enter and Space activate it. Escape closes an overlay. Never set `tabindex` above 0.
- **Accessible name.** Every control has a name. Icon-only buttons need `aria-label` or visually hidden text. Every input needs an associated `<label>`. Meaningful images need `alt`. Decorative images need `alt=""`.
- **Focus management for overlays.** Dialogs and drawers trap focus while open. They return focus to the trigger on close. react-aria-components traps focus in `Modal` and `Dialog`. Keep this behavior if you customize them. Do not remove a focus outline unless you add a visible `:focus-visible` style.
- **Contrast.** Body text needs a contrast ratio of at least 4.5:1. Large text needs at least 3:1. Large text means 18px or larger, or 14px bold or larger. Measure against the real background.
- **No state by color alone.** Add text, an icon, or a shape to show state.
- **Semantic structure.** Use one `<h1>` per view. Keep headings in order. Use `<ul>` or `<ol>` for lists. Use `<table>` for tabular data. Use landmarks such as `<nav>` and `<main>`.
- **Reduced motion.** Remove non-essential animation when the user sets `prefers-reduced-motion`.

## Forms

- Give every field a programmatic label. Placeholder text is not a label.
- Link each error message to its field with `aria-describedby`. Show the error as text.
- For select controls, use `value` and `onChange`. Do not use the deprecated `selectedKey` and `onSelectionChange` props. The `testing-conventions` skill explains why.

## Testing accessibility

Automated checks run axe-core. Add `expectNoA11yViolations` to every new UI component test. The `testing-conventions` skill shows the helper.

```ts
import { render } from '@testing-library/react';
import { expectNoA11yViolations } from './test/a11y';

it('has no accessibility violations', async () => {
  const { container } = render(<MyComponent />);
  await expectNoA11yViolations(container);
});
```

- Pass the render container to scan the component. Call the helper without an argument for components that portal outside the container, such as dialogs, drawers, and tooltips. The helper then scans `document.body`.
- To disable one axe rule while a known issue remains open, pass axe options to the helper. Add a comment that explains the reason. Do not disable `color-contrast` to hide a real failure.
- Do not mock axe. A mocked axe checks nothing.

## Test by hand

axe finds only part of the accessibility issues. Also check the following:

- Move through the feature with the Tab key only. Check that you reach and operate every control, and that focus stays visible.
- Query controls by role and name in tests. A query that finds no control by its name often means the control has no accessible name.
- For icon-only or custom controls, check the `aria-label` and role in the rendered DOM.
