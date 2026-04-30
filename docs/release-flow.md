# Release Flow

The `twincat-mcp` monorepo uses a coordinated lockstep release flow for the
root project, `twincat-mcp-core`, `pi-twincat-ads`, and `twincat-mcp`.

## Version Policy

- Keep the root project, `twincat-mcp-core`, `pi-twincat-ads`, and
  `twincat-mcp` on the same version.
- Keep internal package references on the matching released
  `twincat-mcp-core` version so local npm installs and published manifests use
  the same dependency shape.
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

- `twincat-mcp-core`
- `pi-twincat-ads`
- `twincat-mcp`

## Publish Order

1. Publish `twincat-mcp-core`.
2. Publish `pi-twincat-ads@next` after it resolves the freshly published core.
3. Publish `twincat-mcp` after it resolves the freshly published core.

The Pi and MCP packages both depend on the core package. Publishing the core
first avoids consumers receiving package metadata that points at an unavailable
runtime dependency.

## Package Publish Workflows

The package publish workflows use npm trusted publishing. Configure each npm
package's trusted publisher for GitHub Actions with repository
`Auda29/twincat-mcp-mono` and the matching workflow filename:

| Package | Workflow | Release tag prefix | Default publish dist-tag |
| --- | --- | --- | --- |
| `twincat-mcp-core` | `publish-core.yml` | `core-v*` | `latest` |
| `pi-twincat-ads` | `publish-pi.yml` | `pi-v*` | `next` |
| `twincat-mcp` | `publish-mcp.yml` | `mcp-v*` | `latest` |

On npmjs.com, fill the Trusted Publisher form as:

- Organization or user: `Auda29`
- Repository: `twincat-mcp-mono`
- Workflow filename: the package-specific filename from the table above
- Environment name: leave empty unless the workflow job also declares a GitHub
  Actions environment with the same name

Each workflow can be started manually with `workflow_dispatch`, by pushing a
matching package version tag, or by publishing a GitHub Release whose tag uses
the matching prefix. Manual runs are always `--dry-run`; only version tags or
published releases run the real publish step. npm automatically generates
provenance for trusted publishing from this public repository. Publish jobs skip
the publish step when the package version already exists on npm, so backfilled
release marker tags can still run the verification pipeline.
Releases for other package tag prefixes are ignored by each package publish job.

## Changesets Preparation

Changesets can be added later without changing the package boundaries. When that
happens, use a fixed/linked group for `twincat-mcp-core`, `pi-twincat-ads`,
and `twincat-mcp`.
