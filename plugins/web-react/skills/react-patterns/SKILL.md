---
name: react-patterns
description: "Which React 19 API to use for common problems. Covers useEffectEvent, useDeferredValue, startTransition, useSyncExternalStore, useId, memo, useMemo, useCallback, lazy with Suspense, ref callbacks, and context. Use when adding or reviewing hooks, or when fixing re-render problems."
---

# React patterns

The project uses React 19. Prefer the APIs below over the older workarounds that they replace.

## `useEffectEvent` for callbacks that read the latest values

When an effect calls a function that reads changing state, do not re-run the effect on each change. Use `useEffectEvent`. It replaces two workarounds: suppressing `exhaustive-deps`, and storing the function in a ref.

Avoid:

```ts
const onChangeRef = useRef(onChange);
useEffect(() => {
  socket.on('data', onChangeRef.current);
}, [socket]);
```

Prefer:

```ts
const handleData = useEffectEvent(onChange);
useEffect(() => {
  socket.on('data', handleData);
}, [socket]);
```

## `useDeferredValue` for responsive UI under heavy renders

Wrap a value that updates often in `useDeferredValue`. The UI renders with the previous value first. It applies the new value when the browser is idle. Use this when the value drives expensive derived work or many child renders.

```ts
const deferredQuery = useDeferredValue(query);
```

Pass `deferredQuery` to the expensive filter. Pass `query` to the input that the user types into.

## `startTransition` for non-urgent state updates

Mark a state update as a transition when it does not need to block the current render. React can interrupt a transition render when a more urgent update arrives.

```ts
startTransition(() => setPage(nextPage));
```

## `useSyncExternalStore` for external stores

Use `useSyncExternalStore` to subscribe to a store that lives outside React. Examples include an event emitter, a WebSocket connection status, or a store with its own subscribe function. Do not combine `useEffect` with `useState` for this case. `useSyncExternalStore` gives tear-free reads during concurrent renders.

```ts
const status = useSyncExternalStore(store.subscribe, store.getSnapshot);
```

## `useId` for stable accessibility IDs

Use `useId()` to create IDs that link labels, `aria-controls`, `aria-describedby`, and SVG `<defs>`. Do not generate IDs with `Math.random()` or a module-level counter. Those IDs are not SSR-safe, and they break in concurrent rendering.

```tsx
const id = useId();

<label htmlFor={id}>Name</label>
<input id={id} />
```

## `memo`, `useMemo`, and `useCallback` on purpose

Do not wrap every component and value by default. Memoize in these cases:

- A component renders often and receives stable props, such as individual items in a list of hundreds.
- A derived value costs much to compute, and its inputs stay stable.
- A callback passes to a memoized child.

Do not memoize cheap computations, components that render rarely, or values that change on every render. Extra memoization adds overhead and hides intent.

## `lazy` and `Suspense` for route-level code splitting

Load top-level feature routes with `lazy()`. Wrap each one in `<Suspense>`. Follow this pattern for every new top-level route. Do not import whole feature trees statically at the app entry point.

## Ref callbacks for direct DOM access

When code must read a DOM node or call an imperative API after mount, use a ref callback, such as `ref={(el) => { ... }}`. Prefer it over `useRef` combined with `useEffect`. React runs a ref callback after it inserts the node. You need no separate effect.

## Context for narrow, rarely changing state

Use `createContext` and `useContext` for state shared across a small subtree. Examples include a compound component or one feature's local UI state. Context is not for high-frequency updates. See the `atoms-vs-state` skill.

## Caveats

- The function returned by `useEffectEvent` is not stable. Never list it in a dependency array. Never pass it as a prop to a memoized child.
- `useEffectEvent` can keep stale values inside `memo` or `forwardRef`. On react-dom 19.2.0, the function can hold values from the first render. This happens when you wrap the component, or a hook it calls, in `memo` or `forwardRef`. In that case, use a latest-value ref hook instead.
- One `eslint-disable` for a react-hooks rule turns off all react-hooks rules for the whole component. A pattern that the React Compiler cannot compile does the same. Fix the cause, not only the line.
- Passing `ref={obj.member}` makes the linter treat all of `obj` as a ref. Reads of other `obj` fields during render then fail `react-hooks/refs`. Let the component own the ref. Let the hook expose behavior instead of a ref field.
