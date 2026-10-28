---
name: code-style
description: "House style rules for TypeScript and React code, beyond what eslint and prettier enforce. Covers control-flow braces, one component per file, theme tokens, shared helpers, React render-timing fixes, comment limits, and common Tailwind and UI pitfalls. Use when writing or reviewing TypeScript or React code, or when a review pass should apply project conventions."
---

Apply these rules when you write new code. Apply them also when you review or edit existing code that breaks them.

## Control-flow braces

Wrap the body of every `if`, `else`, `for`, `for...of`, `for...in`, `while`, and `do...while` in braces. Put the braces on their own lines. Do not write brace-less single statements. This includes early `return`, `continue`, and `break`.

Avoid:

```ts
if (!item) continue;
for (const id of ids) delete map[id];
```

Prefer:

```ts
if (!item) {
  continue;
}

for (const id of ids) {
  delete map[id];
}
```

Consistent braces prevent a common bug. A second statement added to a brace-less block runs outside the condition.

## One component per file

Define one React component in each file. Move helper components, such as a row or a label, into their own sibling files. Each component then stays easy to find and import.

This rule does not cover pure helper functions. It also does not cover a file that exports a collection of plain values, such as an icon map.

## Blank line between multiline JSX siblings

When two or more multiline sibling elements sit side by side, separate them with one blank line. Single-line siblings need no blank line. If the file already uses different spacing, match the file.

## Theme tokens before manual light and dark pairs

Use a semantic token from the project theme file before you write a manual light and dark class pair. A token already handles both modes through CSS custom properties.

Replace a pair such as `text-slate-800 dark:text-white` with the theme's default text token. Use the token names that the theme file defines.

Swap a pair only when it maps exactly to a token. Keep off-shade greys manual when no token matches. Keep semantic status colors, such as green, blue, and red, manual unless a matching token exists. Do not force a fit.

## Shared helpers belong in the shared folder

Put a helper that more than one feature uses in the folder named by `sharedLibrary` in `.claude/web-kit.json`. Put color helpers there too, such as hex parsing, contrast checks, and tint or shade functions. Do not place them in a feature file.

Reuse an existing helper before you write a new one. Duplicated helpers are a common and avoidable mistake.

## Fix render-timing warnings

Fix these two warnings. Both point to a real anti-pattern. Do not leave them in place.

- "Calling setState synchronously within an effect can trigger cascading renders." An effect that calls `setState` on each change adds an extra render pass.
- `react-hooks/refs`: "Cannot access/update refs during render." Ref access during render can desync from what React committed.

The sanctioned fix derives the value during render. Compare the input against a previous value kept in state, not in a ref:

```ts
const [prev, setPrev] = useState(value);
if (prev !== value) {
  setPrev(value);
  setDerived(...);
}
```

React re-renders before it commits. This avoids an extra render pass. Do not store the previous value in `useRef`. The `react-hooks/refs` rule forbids reading or writing `.current` during render. See the [react.dev guide on storing information from previous renders](https://react.dev/reference/react/useState#storing-information-from-previous-renders).

## Never suppress exhaustive-deps

Never add an `eslint-disable` comment for `react-hooks/exhaustive-deps`. A suppression hides stale-closure bugs. Fix the dependency list instead:

- Compute cheap derived values inline during render. Skip the memo and the dependency array.
- Move helper logic inside the memo. Then the dependency list holds only primitive and prop values.
- Wrap genuinely stable callbacks in `useCallback`.

## Comments

- Default to no comment. Write one only when the code cannot show the reason.
- An inline `//` comment is two lines at most. A doc block is three lines at most.
- Do not place a doc comment above a top-level component.
- Do not write narrative comments that describe the history of a change or dramatize a bug.

## Libraries before hand-written helpers

- Use lodash before you write a helper. Common choices: `clamp`, `isPlainObject`, `pick`, `merge` or `mergeWith`, and `debounce`. `merge` copies unknown keys without validation, so `pick` the known keys first.
- Use turf.js before you write geospatial math, including math in tests. Common choices: `bbox`, `booleanPointInPolygon`, `distance`, `toMercator`, and `toWgs84`.

## No cross-feature imports

A file in one feature folder must not import from another feature folder. Move the shared code to the folder named by `sharedLibrary` in `.claude/web-kit.json`. Import it from there in both features.

## UI pitfalls

- **Animate enter and exit.** Use animation classes for both transitions. Add `motion-reduce:animate-none`. Prefer framer-motion for shared primitives.
- **No `backdrop-blur` on a transformed element.** This includes slide animations, `transform-gpu`, a react-aria `Modal` with a slide animation, and a `className` that a consumer adds. Place the blur and background on an untransformed child one level below.
- **Field labels use `font-medium` at the label size.** When a shared primitive renders a label at a different weight, fix the primitive.
- **Canvas and chart libraries accept hex colors only.** Tailwind v4 colors use `oklch()`. MapLibre, Konva, and ApexCharts cannot read them. Pass hex values from the theme file.
- **Never hide table columns,** for example with `hidden md:table-cell`. Keep every column. Let the table scroll inside its container.
- **Previews and stories use the live hook.** Mock the hook's inputs, such as API responses and atoms. Never mock its output. The preview then cannot drift from the real UI.
