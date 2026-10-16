# Contributing to Backstage

## Branches

- `main` is protected – never push directly to it.
- Always start from the latest `main`:

```bash
  git checkout main
  git pull
  git checkout -b feature/<module-name>
```

- Naming:
  - `feature/<module-name>` – new functionality (e.g. `feature/sqlite-schema`)
  - `fix/<bug-description>` – bug fixes (e.g. `fix/outbox-retry-delay`)

## Commits – Conventional Commits

Format: `type(scope): short description` – in English, imperative mood ("add", not "added").

| Type       | When                                 | Example                                              |
| ---------- | ------------------------------------ | ---------------------------------------------------- |
| `feat`     | new functionality                    | `feat(auth): add bcryptjs hashing with expo-crypto`  |
| `fix`      | bug fix                              | `fix(storage): add index for range queries`          |
| `refactor` | code change without behaviour change | `refactor(domain): extract haversine calculator`     |
| `test`     | adding or changing tests             | `test(use-cases): verify check-in with frozen clock` |
| `chore`    | config, tooling, DevOps              | `chore(eas): configure apk profile in eas.json`      |
| `docs`     | documentation                        | `docs: update README`                                |

## Pull Requests

1. Push your branch and open a PR to `main`.
2. Fill in the PR template.
3. Attach a screenshot or log of `npm test`.
4. Request at least one reviewer.
5. Merge only after approval, then delete the branch.

## Code Review

- Every PR needs **1 approval** from another team member.
- Comment on specific lines and explain _why_, not only _what_.
- Try to review within 24 hours.

## Architecture rules

- `src/domain` – no imports from `react-native`, `expo-*` or SQLite.
- Use cases receive repositories through the constructor (Dependency Inversion).
- No `any` types.
- Every animation uses `useNativeDriver: true`.
- Text is rendered only inside `<Text>`.

## Before opening a PR

```bash
npm run typecheck
npm test
```
