# Contributing to Lunalink

Thanks for helping. This file covers how to set up the project, the rules every change has to follow, and how changes get reviewed and released.

## Before you start

- For a bug, open an issue with the Lunalink version, the server (Lavalink or NodeLink, with version), the Discord library, and the smallest code that reproduces it. Include the `debug` output if you can.
- For a new feature or a change to public behavior, open an issue first and describe the use case. It's easier to agree on the API before the code exists.
- Small fixes (typos, docs, an obvious bug with a test) can go straight to a pull request.

## Setup

You need Node.js 22 or later.

```sh
git clone https://github.com/SreerajSK990/Lunalink.git
cd Lunalink
npm install
npm run check
```

`npm run check` is the same gate CI uses. It runs, in order: typecheck (library and tests), ESLint, Prettier, the dependency rules, the tests, and the build with publint. A pull request is only reviewed once it passes.

| Script               | What it does                                   |
| -------------------- | ---------------------------------------------- |
| `npm test`           | Runs the test suite once                       |
| `npm run test:watch` | Runs tests on every change                     |
| `npm run lint`       | ESLint                                         |
| `npm run format`     | Formats every file with Prettier               |
| `npm run deps:check` | Checks the layer and dependency rules          |
| `npm run build`      | Builds ESM and CommonJS output with types      |
| `npm run changeset`  | Records a user-facing change for the changelog |

## Rules for code

**Verify protocol details against the server source.** Endpoints, payloads, event names, search prefixes and plugin routes come from the Lavalink, NodeLink or plugin source code, not from memory, blog posts or other client libraries. Say in the pull request which file you checked. Most protocol bugs in other clients come from copying each other.

**No runtime dependencies.** Use Node built-ins. Development dependencies are fine.

**Strict TypeScript.** No `any`. `strict`, `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` stay on. Use `unknown` and narrow it.

**Respect the layers.** Code in `src` is layered, lowest first:

```
protocol, utils, errors, events, transport, capabilities, drivers, node, track,
queue, filters, search, voice, features, player, lifecycle, stores, plugins, core
```

A layer may import from itself and from lower layers only. `adapters`, `stores-builtin` and `testing` may import only the public entry (`src/index.ts`) and protocol types, exactly like third-party code would. `npm run deps:check` fails the build otherwise.

**Comments are JSDoc only.** Every exported function, class, method and type has a JSDoc block with `@param`, `@returns` and `@throws` where they apply. Line comments and plain block comments are rejected by ESLint. Write JSDoc for the people using the library: say what the thing does and what to watch out for. Don't describe how it was planned, and don't reference issues or internal notes.

**Keep files small.** Aim for under 300 lines. Split by responsibility before you get near 1000.

**Errors are part of the API.** Throw `LunalinkError` or one of its subclasses with a code from `ErrorCode`. The message should tell a bot developer what went wrong and what to do about it.

**Never swallow failures silently.** If something fails and Lunalink carries on, report it through the `debug` event (or `pluginError` for plugins).

## Rules for tests

- Every behavior change comes with a test. Bug fixes come with a test that fails without the fix.
- Unit tests go in `test/unit`. Tests that talk to a server go in `test/integration` and use `MockNode` from `src/testing`.
- Tests must not depend on timing luck. Use fake timers or wait for the event you expect.
- If a change touches audio, voice, resume or failover, also run the relevant part of the [manual checklist](docs/TESTING.md) against real Lavalink and NodeLink servers, and say so in the pull request.

## Rules for docs

- Public API changes update the matching page in `docs/` in the same pull request.
- Write plainly: short sentences, real examples, no marketing language and no emoji.
- Only document behavior that exists. If something is limited or not implemented, say so.

## Commits and pull requests

- One logical change per pull request. Refactors go in their own pull request.
- Commit messages use a type prefix and the imperative mood, for example `feat: add lyrics search`, `fix: keep volume after a node move`, `docs: explain failover timing`. Types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `chore`.
- Run `npm run changeset` for anything a user would notice, and describe it from their point of view.
- Fill in the pull request description: what changed, why, how you tested it, and which server versions you checked.

## Releases

Maintainers release with Changesets. `npm run release` runs the full check and publishes. The plugin API has its own version (`PLUGIN_API_VERSION`); a change that breaks plugins needs a new plugin API version and a note in the changelog.

## License

By contributing you agree that your contribution is licensed under the MIT License.
