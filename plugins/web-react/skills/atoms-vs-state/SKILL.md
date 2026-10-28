---
name: atoms-vs-state
description: "When to use Jotai atoms instead of React state or context. Covers high-frequency updates, shared slices, imperative reads, state read outside React, exported hooks, and one store per subtree. Use when adding or changing an atom file, or when a frequent update would re-render a large context consumer tree."
---

The project uses **Jotai** for state that would cause re-render cascades through React context or props. Use atoms for state that updates many times per second. Use them also for state that many independent sibling components share.

## When to stay with React state or context

Use `useState`, `useReducer`, or context for:

- State that one small subtree reads.
- State that updates rarely, such as user actions, route changes, or data fetches that settle.
- State that one component owns and passes to children one or two levels below.

This is the default. Do not reach for atoms early.

## When to introduce atoms

### 1. High-frequency writes through context

A context value object that changes on every tick re-renders every consumer. Consumers re-render even when they ignore the changing field.

Put the fast-changing value in an atom and export a hook for it:

```ts
const playbackMsAtom = atom(0);

export function usePlaybackMs(): number {
  return useAtomValue(playbackMsAtom);
}
```

Only components that call `usePlaybackMs` re-render on each tick. The rest of the tree does not re-render.

### 2. Many siblings that each need one slice

When many components each need a different part of the same value, context re-renders all of them on any write. Use `selectAtom` from `jotai/utils`. Each subscriber receives a derived atom. That derived atom notifies only when its own slice changes.

```ts
const hoveredItemIdAtom = atom<string | null>(null);

export function useIsItemHovered(itemId: string): boolean {
  const isHoveredAtom = useMemo(
    () => selectAtom(hoveredItemIdAtom, (hoveredId) => hoveredId === itemId),
    [itemId]
  );
  return useAtomValue(isHoveredAtom);
}
```

Without `selectAtom`, every item re-renders when a user hovers over any other item.

### 3. Reading the latest value without subscribing

Some code needs an atom value only at certain moments, such as on mount or inside a callback. `useAtomValue` subscribes and re-renders on every write. Call `store.get(atom)` instead. It returns the current value and does not subscribe.

```ts
const store = useStore();

const readPlaybackMs = useCallback(() => store.get(playbackMsAtom), [store]);
```

A feed hook can call `readPlaybackMs` when it loads data. It does not re-render on each tick. Use `useStore()` with `store.get(atom)` inside callbacks and effects.

### 4. State read outside React

Atoms live in the Jotai store. Code outside React can reach that store through `getDefaultStore()` or `useStore()`. Use this path for imperative code, cross-tab sync, and Storybook stories. For example, a cross-tab sync hook can watch an atom through `useStore()` and broadcast each change to other tabs.

## Batching writes with write-only atoms

When several atoms must change together, bundle the writes in a write-only atom. Observers then see one update, not one per field:

```ts
const applyFiltersAtom = atom(null, (_get, set, next: FilterState) => {
  set(dateRangeAtom, next.dateRange);
  set(selectedTypesAtom, next.selectedTypes);
  set(sortOrderAtom, next.sortOrder);
});
```

This works like `useReducer`. Bundle related changes so that observers never see a partial state.

## Encapsulation: export hooks, not atoms

An atom is a key into the store. Any module that imports the atom can read it, write it, and subscribe to it. Control access with the module boundary:

- Do not export the atom. Declare it with `const` only.
- Export one hook for each operation that callers need. Name the hook for the action, not for the atom.
- Keep each `selectAtom` slice private inside the module. Callers receive a slice hook, not the full value.

```ts
const hoveredRowAtom = atom<string | null>(null);

export function useSetHoveredRow() {
  return useSetAtom(hoveredRowAtom);
}
```

Reasons:

- A write-only hook (`useSetAtom`) cannot cause a re-render in its caller. A caller that holds the raw atom can call `useAtom` and subscribe by accident.
- A caller that reads the full atom instead of a slice re-renders on every write. That removes the reason to use an atom. See section 2.
- One file owns every read and write. Searching for the hook name finds every consumer.

Exceptions:

- **Code outside React.** If imperative code must read the atom, export a function that takes the store, such as `readPlaybackMs(store)`. Do not export the atom.
- **Write-only batch atoms.** Keep the batch atom private. Export `useApply<Thing>()`, which returns `useSetAtom(batchAtom)`.
- **Tests.** Test through the exported hooks with `renderHook` inside a `<Provider store={createStore()}>`. Do not export an atom only for a test.

## Scoping values: one store per subtree

Encapsulation controls who can touch an atom. It does not control which value a component sees. All components under one `Provider` share one value for each atom. Two mounted views share one hover state.

To give a subtree its own values, wrap it in a `Provider` with its own store. Create the store once for the subtree's lifetime:

```tsx
const [store] = useState(() => createStore());

return <Provider store={store}>{children}</Provider>;
```

For example, a preview that renders beside a live view can use its own store. Its hover state then stays out of the live view.

A new store isolates every atom. An atom read inside the subtree returns its default value, not the app value. Pass app state into the subtree with props or context.

To isolate only some atoms, use `ScopeProvider` from the `jotai-scope` package. Add that package only when a subtree must share some atoms with the app and isolate others.

## Naming and file conventions

- Put atom files next to the feature that owns them, in a `state/` folder.
- Name a file `<thing>-atom.ts` for one atom. Name it `<thing>-atoms.ts` for several related atoms and hooks.
- End each atom name with `Atom`, such as `viewTimeAtom` or `hoveredItemIdAtom`. Keep atom names private to the module.
- Start each exported hook name with `use`, such as `useIsItemHovered` or `useSetHoveredRow`.
- Do not declare atoms in component files. Keep them in their own modules, so the hooks import without the component tree.

## Hooks summary

| Hook | When to use |
|---|---|
| `useAtomValue(atom)` | Read and subscribe. Re-renders on change. The default read pattern. |
| `useSetAtom(atom)` | Write only. Does not subscribe, so the component does not re-render on reads. Prefer it over `useAtom` when you only write. |
| `useAtom(atom)` | Read and write. Returns `[value, setter]`. Use it when one component both reads and writes. |
| `store.get(atom)` | Imperative read inside a callback or effect. Does not subscribe. Requires `useStore()`. |
| `selectAtom(atom, selector)` | Derives a memoized sub-atom. The subscriber re-renders only when the selector result changes. Import it from `jotai/utils`. |

## Don'ts

- Do not export a raw atom from a new atom file. Export hooks instead.
- Do not put atoms inside context. That defeats the purpose. Atoms are global by default within their `Provider` scope.
- Do not use `useAtom` when you only write. Use `useSetAtom` to avoid an unnecessary subscription.
- Do not declare atoms inside render functions. Each render creates a new atom, which loses the old identity.
- Do not use atoms in place of props when a prop or lifted state would do. Atoms bypass the component tree and make data flow harder to trace.
