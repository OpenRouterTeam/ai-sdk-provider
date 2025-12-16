# Changesets

Hello! This folder contains [Changesets](https://github.com/changesets/changesets), which help manage releases and changelogs.

## Adding a changeset

To create a new changeset, run:

```bash
pnpm changeset
```

This will prompt you for:

1. Which type of change (patch/minor/major)
2. A summary of the changes

The tool will create a markdown file in `.changeset/` with your changes.

## How releases work

When changes are merged to `main`:

1. The Release workflow creates/updates a "Version Packages" PR
2. This PR will bump versions and update CHANGELOGs based on all changesets
3. When you merge the "Version Packages" PR, packages are automatically published to npm

## Empty changesets

If your changes don't need a release (docs, tests, CI config):

```bash
pnpm changeset --empty
```
