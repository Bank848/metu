#!/usr/bin/env python
"""
Phase 38 - one-shot Python runner for the commit history cleanup.

Replaces the PowerShell runner entirely so we sidestep PowerShell's
argument parser (which mangles multi-line strings with quotes when
passed to `git filter-repo --commit-callback STRING`).

Flow:
  1. Verifies the safety tag exists (creates + pushes if missing).
  2. Prints a preview of the first 5 long-body rewrites.
  3. Asks 'YES' to proceed with filter-repo.
  4. Runs filter-repo via git-filter-repo's Python API + the
     hand-curated overrides at scripts/commit-overrides.py.
  5. Shows the new top-10 log.
  6. Asks 'YES' to force-push.

Usage:
  python scripts/cleanup.py

Rollback (after running, if something looks off):
  git reset --hard pre-commit-cleanup-2026-04-30
  git push --force-with-lease origin main
"""
import importlib.util
import os
import subprocess
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(REPO_ROOT)


# ───────────────────────────────────────────────────────────────────
# Bootstrap: Windows often has multiple Pythons in PATH and `python`
# may not be the one pip installed git-filter-repo into. If our import
# fails, find a Python that DOES have it and re-exec the script there.
# ───────────────────────────────────────────────────────────────────
def _bootstrap_python():
    # If we already re-exec'd ourselves, don't loop. Either the import
    # works (good) or we crash with a real error (also good - we'll see
    # what's wrong in the traceback).
    if os.environ.get("METU_CLEANUP_BOOTSTRAPPED") == "1":
        try:
            import git_filter_repo  # noqa: F401
            return
        except ImportError as e:
            print(
                f"ERROR: even after re-exec, git_filter_repo failed to import: {e}\n"
                f"Python: {sys.executable}\n"
                f"sys.path: {sys.path}",
                file=sys.stderr,
            )
            sys.exit(2)

    try:
        import git_filter_repo  # noqa: F401
        return  # we're good
    except ImportError:
        pass

    # Manual override - user can set METU_PYTHON to skip auto-detect.
    override = os.environ.get("METU_PYTHON")
    if override:
        candidates = [override]
    else:
        candidates = []
        # Hard-coded common Windows install locations FIRST so we use
        # the absolute path directly (no PATH lookup, no py-launcher
        # resolution that can return a different binary on re-exec).
        if os.name == "nt":
            local_app = os.environ.get("LOCALAPPDATA", "")
            for ver in ("313", "312", "311"):
                candidates.append(
                    os.path.join(local_app, "Programs", "Python", f"Python{ver}", "python.exe"),
                )
            for ver in ("313", "312", "311"):
                candidates.append(rf"C:\Python{ver}\python.exe")
        # Then PATH-based fallbacks.
        for cmd in ("python3.13", "python3.12", "python3.11", "python3", "python", "py"):
            candidates.append(cmd)

    for cand in candidates:
        if not cand:
            continue
        try:
            # Probe: import the module AND tell us which Python actually
            # imported it. We use that python's sys.executable (absolute
            # path) for re-exec so PATH / launcher resolution can't
            # silently pick a different Python.
            probe = subprocess.run(
                [cand, "-c", "import git_filter_repo, sys; print(sys.executable)"],
                capture_output=True,
                text=True,
                timeout=10,
            )
        except (FileNotFoundError, subprocess.TimeoutExpired, PermissionError):
            continue
        if probe.returncode != 0:
            continue
        actual_python = probe.stdout.strip().splitlines()[-1] if probe.stdout.strip() else cand
        if not os.path.exists(actual_python):
            # py launcher with --list-paths or odd setups can print a non-path string
            actual_python = cand
        print(f"[bootstrap] re-exec with {actual_python}")
        child_env = {**os.environ, "METU_CLEANUP_BOOTSTRAPPED": "1"}
        result = subprocess.run([actual_python, __file__, *sys.argv[1:]], env=child_env)
        sys.exit(result.returncode)

    print(
        "ERROR: no Python on this machine has git-filter-repo installed.\n"
        "Run:  pip install git-filter-repo\n"
        "Or with the explicit Python:\n"
        "  C:/Users/zxcas/AppData/Local/Programs/Python/Python313/python.exe -m pip install git-filter-repo",
        file=sys.stderr,
    )
    sys.exit(1)


_bootstrap_python()

# ANSI escape codes (work in Windows Terminal + modern PowerShell).
GREEN = "\033[1;32m"
YELLOW = "\033[1;33m"
RED = "\033[1;31m"
DIM = "\033[2m"
NC = "\033[0m"


def run(cmd, **kwargs):
    """Thin wrapper around subprocess.run that surfaces stderr."""
    return subprocess.run(cmd, check=False, **kwargs)


def print_step(msg):
    print(f"\n{GREEN}=== {msg} ==={NC}")


def fatal(msg):
    print(f"\n{RED}FATAL: {msg}{NC}", file=sys.stderr)
    sys.exit(1)


# ───────────────────────────────────────────────────────────────────
# Step 1 — backup tag
# ───────────────────────────────────────────────────────────────────
print_step("Phase 38 commit history cleanup")

tag_check = run(
    ["git", "rev-parse", "pre-commit-cleanup-2026-04-30"],
    capture_output=True,
    text=True,
)
if tag_check.returncode == 0:
    print(f"{GREEN}OK{NC} backup tag exists: pre-commit-cleanup-2026-04-30")
else:
    print(f"{YELLOW}Creating backup tag...{NC}")
    if run(["git", "tag", "pre-commit-cleanup-2026-04-30", "main"]).returncode != 0:
        fatal("could not create local tag")
    run(["git", "push", "origin", "pre-commit-cleanup-2026-04-30"])
    print(f"{GREEN}OK{NC} backup tag created + pushed")

# ───────────────────────────────────────────────────────────────────
# Step 2 — load + verify the override map
# ───────────────────────────────────────────────────────────────────
override_path = os.path.join(REPO_ROOT, "scripts", "commit-overrides.py")
if not os.path.exists(override_path):
    fatal(f"missing {override_path} - regenerate via the agent first")

spec = importlib.util.spec_from_file_location("commit_overrides", override_path)
co_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(co_mod)
OVERRIDES = co_mod.COMMIT_OVERRIDES

filled = sum(1 for v in OVERRIDES.values() if v)
empty = sum(1 for v in OVERRIDES.values() if not v)
print(f"{GREEN}OK{NC} loaded {len(OVERRIDES)} overrides ({filled} with body, {empty} subject-only)")

# ───────────────────────────────────────────────────────────────────
# Step 3 — preview
# ───────────────────────────────────────────────────────────────────
print_step("Preview (first 5 long-body rewrites)")
preview = run(
    ["node", "scripts/preview-commit-cleanup.mjs", "--changed-only", "--limit", "5"],
    capture_output=True,
    text=True,
    encoding="utf-8",
)
sys.stdout.write(preview.stdout)
if preview.stderr.strip():
    sys.stderr.write(preview.stderr)

print_step("Total summary")
total = run(
    ["node", "scripts/preview-commit-cleanup.mjs"],
    capture_output=True,
    text=True,
    encoding="utf-8",
)
last_line = (total.stdout or "").strip().splitlines()[-1] if total.stdout else "(no output)"
print(last_line)

# ───────────────────────────────────────────────────────────────────
# Step 4 — confirm + run filter-repo
# ───────────────────────────────────────────────────────────────────
print(f"\n{RED}This rewrites every commit's SHA on main.{NC}")
print(f"{DIM}AuthorDate + CommitDate are preserved (timestamps stay original).{NC}")
print(f"{DIM}Code is untouched - only commit messages change.{NC}\n")
confirm = input("Type YES to run filter-repo: ").strip()
if confirm != "YES":
    print("Aborted.")
    sys.exit(0)

print_step("Running git filter-repo")

# Bootstrap above guarantees this import works ; the second import is
# just here to bring the symbol into local scope.
import git_filter_repo as fr

KEEP_AS_IS_LINES = 3
BAD_TRAILERS = ("co-authored-by: claude", "generated with", "🤖")


def strip_trailers(body: str) -> str:
    return "\n".join(
        ln for ln in body.splitlines()
        if not any(m in ln.lower() for m in BAD_TRAILERS)
    ).strip()


def commit_callback(commit, _meta):
    raw = commit.message.decode("utf-8", errors="replace")
    lines = raw.split("\n")
    if not lines:
        return
    subject = lines[0]
    body = "\n".join(lines[1:]).strip()

    if commit.parents and len(commit.parents) > 1:
        return

    short_hash = commit.original_id.decode("ascii")[:7]
    if short_hash in OVERRIDES:
        override = OVERRIDES[short_hash]
        if override:
            commit.message = f"{subject}\n\n{override}\n".encode("utf-8")
        elif body:
            commit.message = f"{subject}\n".encode("utf-8")
        return

    body_lines = len(body.splitlines()) if body else 0
    has_trailer = any(m in body.lower() for m in BAD_TRAILERS)
    if body_lines <= KEEP_AS_IS_LINES and not has_trailer:
        return
    if body_lines > KEEP_AS_IS_LINES:
        commit.message = f"{subject}\n".encode("utf-8")
    else:
        cleaned = strip_trailers(body)
        commit.message = (
            f"{subject}\n\n{cleaned}\n".encode("utf-8") if cleaned
            else f"{subject}\n".encode("utf-8")
        )


try:
    args = fr.FilteringOptions.parse_args(["--force"])
    repo_filter = fr.RepoFilter(args, commit_callback=commit_callback)
    repo_filter.run()
except SystemExit as e:
    if e.code not in (0, None):
        fatal(f"filter-repo exited with code {e.code}")
except Exception as e:
    fatal(f"filter-repo crashed: {type(e).__name__}: {e}")

print(f"{GREEN}OK{NC} filter-repo finished")

# ───────────────────────────────────────────────────────────────────
# Step 5 — show new log + confirm push
# ───────────────────────────────────────────────────────────────────
print_step("After rewrite (top 10 commits)")
log = run(["git", "log", "--oneline", "-10"], capture_output=True, text=True)
sys.stdout.write(log.stdout)

print(f"\n{YELLOW}If anything looks wrong, rollback with:{NC}")
print("  git reset --hard pre-commit-cleanup-2026-04-30")
print("  git push --force-with-lease origin main")
print()

confirm2 = input("Type YES to force-push to origin/main: ").strip()
if confirm2 != "YES":
    print("Local rewrite kept. Push later with:")
    print("  git push --force-with-lease origin main")
    sys.exit(0)

push = run(["git", "push", "--force-with-lease", "origin", "main"])
if push.returncode == 0:
    print(f"\n{GREEN}OK history rewritten + pushed.{NC}")
else:
    print(f"\n{RED}Push failed - history is rewritten locally but not on origin.{NC}")
    print("Try again: git push --force-with-lease origin main")
    sys.exit(1)
