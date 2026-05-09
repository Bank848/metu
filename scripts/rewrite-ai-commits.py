#!/usr/bin/env python3
"""
Rewrite the 10 AI-essay commit messages between 29f3fcd^..HEAD with
concise human-style titles. Mobile-fix commits (afd9fdf..138f7cf) and
any other commits NOT in REWRITES are preserved verbatim by the
default `cat` branch in the msg-filter.

Edit REWRITES below before running if you want different copy.
After it succeeds, verify with `git log --oneline` and force-push:

    git push origin main --force-with-lease
    git update-ref -d refs/original/refs/heads/main   # drop backup ref

Anyone with a checkout will need to `git fetch && git reset --hard
origin/main` after this lands. Fly auto-deploy on push will rebuild
once. Tree contents are identical — only commit metadata changed.
"""

import os
import subprocess
import sys
import tempfile

# (sha-prefix -> new title-only message). Title-only per the
# feedback_conventional_commits.md memory rule.
REWRITES = {
    "29f3fcd": "chore: scrub ai-tail comments + finding-id markers",
    "c592891": "feat(gift): redemption flow with hmac token",
    "8df9ff3": "feat(gift): block buyer from claiming gift orders",
    "e5ecedb": "fix(gift): require recipient email + block self-gift + dedupe",
    "f65315c": "feat(gift): buyer reclaim before recipient views",
    "51c7baf": "chore: resolve pr #2 merge conflicts",
    "3e2910c": "feat(auth): backup codes for login/disable/change-password",
    "0b81d1d": "chore(seed): rotate demo passwords",
    "c2a6ae4": "feat(admin): platform earnings kpi on overview",
    "f8a6d0a": "fix(web): add undici as direct dep",
}
EARLIEST = "c592891"


def sh(*args):
    return subprocess.check_output(args, text=True).strip()


def main():
    # Sanity: clean tree, on main
    status = sh("git", "status", "--porcelain")
    if status:
        sys.exit("Working tree dirty. Commit or stash first.")
    branch = sh("git", "rev-parse", "--abbrev-ref", "HEAD")
    if branch != "main":
        sys.exit(f"Not on main (currently {branch}). Switch first.")

    # Resolve sha prefixes to full hashes
    full = {sh("git", "rev-parse", k): v for k, v in REWRITES.items()}
    parent = sh("git", "rev-parse", f"{EARLIEST}^")

    # Print plan
    print("Planned rewrites:")
    for prefix, new in REWRITES.items():
        old = sh("git", "log", "-1", "--format=%s", prefix)
        print(f"  {prefix}  {old}")
        print(f"           -> {new}")
    print()
    print("Other commits in range will be preserved verbatim.")
    print()
    if input("Apply? [y/N] ").strip().lower() != "y":
        sys.exit("Aborted.")

    # Build a POSIX shell msg-filter script that dispatches by GIT_COMMIT
    lines = ["#!/bin/sh", 'case "$GIT_COMMIT" in']
    for sha, msg in full.items():
        safe = msg.replace("'", "'\\''")
        lines.append(f"  {sha}) printf '%s\\n' '{safe}' ;;")
    lines.append("  *) cat ;;")
    lines.append("esac")

    fd, path = tempfile.mkstemp(suffix=".sh")
    with os.fdopen(fd, "w", newline="\n") as f:
        f.write("\n".join(lines) + "\n")
    os.chmod(path, 0o755)
    # Forward-slashes for git-bash on Windows
    filter_arg = path.replace("\\", "/")

    try:
        env = {**os.environ, "FILTER_BRANCH_SQUELCH_WARNING": "1"}
        subprocess.run(
            ["git", "filter-branch", "-f",
             "--msg-filter", f"sh {filter_arg}",
             f"{parent}..HEAD"],
            check=True, env=env,
        )
    finally:
        os.unlink(path)

    print()
    print("Done. Verify:")
    print(f"  git log --oneline {EARLIEST}^..HEAD")
    print()
    print("Then force-push:")
    print("  git push origin main --force-with-lease")
    print()
    print("Filter-branch keeps a backup ref at refs/original/refs/heads/main.")
    print("Drop it after you're happy:")
    print("  git update-ref -d refs/original/refs/heads/main")


if __name__ == "__main__":
    main()
