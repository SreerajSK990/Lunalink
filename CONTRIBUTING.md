# Contributing

## Setup

```sh
npm install
npm run check
```

`npm run check` runs everything CI runs: typecheck (library and tests), ESLint, Prettier, the dependency rules, the tests and the build with publint. It must pass before every commit.

| Script                            | Does                                  |
| --------------------------------- | ------------------------------------- |
| `npm test` / `npm run test:watch` | Vitest                                |
| `npm run lint`                    | ESLint                                |
| `npm run format`                  | Prettier, writing                     |
| `npm run deps:check`              | Layer and dependency rules            |
| `npm run build`                   | tsdown, ESM and CJS with declarations |
| `npm run changeset`               | Describe a change for the changelog   |

## Rules

- **Verify against the server source.** Never write an endpoint, payload, event or prefix from memory or from another client library. Read it in the Lavalink, NodeLink or plugin source and note the file in the pull request.
- **No runtime dependencies.** Node built-ins only. Development dependencies are fine.
- **Comments are JSDoc only.** Every exported symbol has JSDoc with `@param`, `@returns` and `@throws` where they apply. No line comments and no plain block comments; ESLint enforces this. Write for library users: describe what a thing does, not how or why it was planned.
- **Layers.** `src` is layered: `protocol → utils → errors → events → transport → capabilities → drivers → node → track → queue → filters → search → voice → features → player → lifecycle → stores → plugins → core`. A layer imports only from itself and lower layers. `adapters`, `stores-builtin` and `testing` import only the public barrel (`src/index.ts`) or protocol types. `npm run deps:check` enforces this.
- **Strict TypeScript.** No `any`. `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` are on.
- **File size.** Keep files under 300 lines where you can; the hard limit is 1000.
- **Errors.** Throw `LunalinkError` subclasses with a code from `ErrorCode` and a message a bot developer understands.

## Tests

Unit tests live in `test/unit`, tests against the mock server in `test/integration`. The mock server is `MockNode` from `src/testing`, the same one users get from `lunalink/testing`. Add a test with every behavior change, and run the [manual checklist](docs/TESTING.md) for changes that touch audio, voice or resume.

## Commits and releases

Write commit messages in the imperative (`feat: …`, `fix: …`, `docs: …`). Add a changeset (`npm run changeset`) for anything users will notice.
