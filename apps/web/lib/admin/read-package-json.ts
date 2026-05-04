/**
 * package.json reader for the admin tech-stack page.
 * Server-only fs helper that walks the workspace package.json files at
 * BUILD TIME (the page is `force-static`) so the rendered table reflects
 * exactly what was installed when this build shipped. Reading at request
 * time would also work, but `force-static` keeps the page free.
 * Resolves paths relative to the Next.js `process.cwd()` — the standalone
 * Fly build runs from `/app/apps/web` so we walk up two levels to reach
 * the monorepo root. Local dev runs `npm run dev -w @metu/web` from the
 * repo root with `cwd = apps/web`, so the same path traversal works.
 * Returns a flat list of `{layer, name, version}` entries deduped by
 * `name` (workspace deps are listed once even if multiple packages
 * declare them — first-occurrence wins, mirroring how npm hoisting
 * surfaces a single resolution).
 */
import fs from "node:fs";
import path from "node:path";

interface PackageManifest {
  name?: string;
  description?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const ROOTS: Array<{ layer: string; rel: string }> = [
  { layer: "Root",     rel: "package.json" },
  { layer: "Web",      rel: "apps/web/package.json" },
  { layer: "Server",   rel: "apps/server/package.json" },
  { layer: "Database", rel: "packages/db/package.json" },
];

/** Walk up from cwd to find the monorepo root (where the workspaces live). */
function findRepoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (
      fs.existsSync(path.join(dir, "package.json")) &&
      fs.existsSync(path.join(dir, "apps")) &&
      fs.existsSync(path.join(dir, "packages"))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback — return cwd, the readManifests() loop will simply find
  // nothing and the page renders the curated metadata with "—" versions.
  return process.cwd();
}

export interface DependencyVersion {
  layer: string;
  name: string;
  version: string;
}

/**
 * Returns a Map<packageName, DependencyVersion> built from the union of
 * dependencies + devDependencies across the four workspace package.json
 * files. Earliest occurrence (Root → Web → Server → Database) wins on
 * conflict — matches the npm hoisting precedence a casual reader would
 * expect.
 */
export function readManifests(): Map<string, DependencyVersion> {
  const root = findRepoRoot();
  const versions = new Map<string, DependencyVersion>();

  for (const { layer, rel } of ROOTS) {
    const fullPath = path.join(root, rel);
    if (!fs.existsSync(fullPath)) continue;
    let manifest: PackageManifest;
    try {
      manifest = JSON.parse(fs.readFileSync(fullPath, "utf8")) as PackageManifest;
    } catch {
      continue;
    }
    const all = { ...(manifest.dependencies ?? {}), ...(manifest.devDependencies ?? {}) };
    for (const [name, version] of Object.entries(all)) {
      if (!versions.has(name)) {
        versions.set(name, { layer, name, version });
      }
    }
  }

  return versions;
}

/** Reads root package.json and returns the project description string. */
export function readProjectTagline(): string | null {
  const root = findRepoRoot();
  const pkgPath = path.join(root, "package.json");
  if (!fs.existsSync(pkgPath)) return null;
  try {
    const manifest = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as PackageManifest;
    return manifest.description ?? null;
  } catch {
    return null;
  }
}
