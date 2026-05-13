# Changesets

This folder is managed by [changesets](https://github.com/changesets/changesets). Every PR that changes user-facing behavior of a published package should include a changeset.

## Adding a changeset

```sh
pnpm changeset
```

Pick the packages that changed, the bump type (`patch` / `minor` / `major`), and write a short summary in the imperative mood. The summary becomes a CHANGELOG entry.

## Releasing

Maintainers run:

```sh
pnpm version-packages   # consume changesets, bump versions, update CHANGELOGs
pnpm release            # build all packages and publish to npm
```
