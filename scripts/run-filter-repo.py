#!/usr/bin/env python
"""
Phase 38 - Python wrapper around git-filter-repo so PowerShell doesn't
mangle the multi-line callback string when we try to pass it via
--commit-callback STRING.

This script imports git-filter-repo as a library, loads the
hand-curated overrides + the cleanup callback as real Python objects,
and runs the rewrite directly. No shell quoting hell.

Usage:
  python scripts/run-filter-repo.py
"""
import os
import sys
import importlib.util

# 1. Import git-filter-repo as a library.
try:
    import git_filter_repo as fr
except ImportError:
    print("ERROR: git-filter-repo isn't importable as a Python module.", file=sys.stderr)
    print("Install with: pip install git-filter-repo", file=sys.stderr)
    sys.exit(1)

# 2. Load the override map.
HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location(
    "commit_overrides",
    os.path.join(HERE, "commit-overrides.py"),
)
co_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(co_mod)
OVERRIDES = co_mod.COMMIT_OVERRIDES

KEEP_AS_IS_LINES = 3
BAD_TRAILERS = (
    "co-authored-by: claude",
    "generated with",
    "🤖",
)


def strip_trailers(body: str) -> str:
    cleaned = []
    for ln in body.splitlines():
        lower = ln.lower()
        if any(marker in lower for marker in BAD_TRAILERS):
            continue
        cleaned.append(ln)
    return "\n".join(cleaned).strip()


def commit_callback(commit, _meta):
    raw = commit.message.decode("utf-8", errors="replace")
    lines = raw.split("\n")
    if not lines:
        return

    subject = lines[0]
    body = "\n".join(lines[1:]).strip()

    if commit.parents and len(commit.parents) > 1:
        return  # leave merge commits alone

    short_hash = commit.original_id.decode("ascii")[:7]
    if short_hash in OVERRIDES:
        override = OVERRIDES[short_hash]
        if override:
            new_msg = f"{subject}\n\n{override}\n"
        elif body:
            new_msg = f"{subject}\n"
        else:
            return
        commit.message = new_msg.encode("utf-8")
        return

    body_lines = len(body.splitlines()) if body else 0
    has_trailer = any(m in body.lower() for m in BAD_TRAILERS)
    if body_lines <= KEEP_AS_IS_LINES and not has_trailer:
        return
    if body_lines > KEEP_AS_IS_LINES:
        new_msg = f"{subject}\n"
    else:
        cleaned = strip_trailers(body)
        new_msg = f"{subject}\n\n{cleaned}\n" if cleaned else f"{subject}\n"
    commit.message = new_msg.encode("utf-8")


def main():
    args = fr.FilteringOptions.parse_args(["--force"])
    repo_filter = fr.RepoFilter(args, commit_callback=commit_callback)
    repo_filter.run()


if __name__ == "__main__":
    main()
