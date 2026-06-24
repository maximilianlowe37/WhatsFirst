---
name: expo-notifications Metro transitive dep fix
description: Metro bundler fails to resolve define-data-property when expo-notifications is installed in a pnpm monorepo.
---

**Rule:** After installing `expo-notifications` in the `artifacts/whats-first` (Expo) package, Metro will throw `Unable to resolve "define-data-property"`. Fix by running:
```
pnpm --filter @workspace/whats-first add define-data-property
```

**Why:** pnpm's strict hoisting means `set-function-length@1.2.2` cannot find its own peer `define-data-property` via the flat `node_modules` Metro uses. Adding it explicitly to the artifact's own `node_modules` lets Metro resolve it.

**How to apply:** Any time `expo-notifications` is added (or its version is bumped) and Metro shows the `define-data-property` error, run the above install command and restart the Expo workflow.
