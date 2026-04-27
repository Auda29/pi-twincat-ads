# Release Flow

This monorepo uses a prepared lockstep release flow for the root package,
`twincat-ads-core`, and `pi-twincat-ads`. The MCP package is introduced as
`twincat-ads-mcp@0.1.0` for its first public server release, then joins the
same coordinated release train once the MCP package is established.

## Version Policy

- Keep the root package, `twincat-ads-core`, and `pi-twincat-ads` on the same
  version.
- Keep internal package references as `workspace:*` in source manifests. The
  `prepack`/`postpack` lifecycle rewrites these to released package versions
  inside package tarballs and restores the source manifests afterward.
- Keep `twincat-ads-mcp` at `0.1.0` for the first MCP server release.
- Do not introduce Changesets yet. The repository should remain compatible with
  a later Changesets migration by keeping release notes package-scoped and by
  avoiding ad hoc per-package version bumps.

## Pre-Release Checks

Run the root checks before publishing any package:

```sh
npm run check
npm run check:workspace
npm test
npm run build
npm run pack:dry-run
```

`npm run pack:dry-run` validates the package contents for all three published
packages:

- `twincat-ads-core`
- `pi-twincat-ads`
- `twincat-ads-mcp`

## Publish Order

1. Publish `twincat-ads-core`.
2. Publish `pi-twincat-ads@next` after it resolves the freshly published core.
3. Publish `twincat-ads-mcp@0.1.0` after it resolves the freshly published core.

The Pi and MCP packages both depend on the core package. Publishing the core
first avoids consumers receiving package metadata that points at an unavailable
runtime dependency.

## Pi Publish Workflow

`.github/workflows/publish-pi.yml` publishes `pi-twincat-ads` with npm. It can
be started manually with `workflow_dispatch`, by pushing a `pi-v*` version tag,
or by publishing a GitHub Release whose tag starts with `pi-v`. The workflow
expects an `NPM_TOKEN` repository secret with publish rights for the package.
Manual runs are always `--dry-run`; only version tags or published releases run
the real publish step with provenance and the `next` dist-tag. Releases for
other package tags are ignored by the Pi publish job.

## Changesets Preparation

Changesets can be added later without changing the package boundaries. When that
happens, use a fixed/linked group for `twincat-ads-core` and `pi-twincat-ads`,
then decide whether `twincat-ads-mcp` joins the same group after its `0.1.0`
line is published.
