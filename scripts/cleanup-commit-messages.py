"""
Phase 38 - git filter-repo callback that rewrites commit BODIES using a
hash-keyed override map. Subject lines are preserved verbatim.

Two paths:
1. Hash override (the common path): scripts/commit-overrides.py supplies
   a {short_hash: new_body} dict. Empty string means "drop the body
   entirely". The dict was hand-curated for every commit on the branch.
2. Fallback (no override + body > 3 lines): drop the body. This only
   triggers for new commits added after the cleanup script was authored.

AI-trailer markers (Co-Authored-By: Claude, Generated with, robot
emoji) are stripped wherever they appear, even on short bodies.

Run:
  python -m git_filter_repo --commit-callback "$(cat scripts/cleanup-commit-messages.py)"

Preserves AuthorDate + CommitDate. Force-push afterwards.
"""
import os
import importlib.util

KEEP_AS_IS_LINES = 3
BAD_TRAILERS = (
    "co-authored-by: claude",
    "generated with",
    "🤖",
)

# Load the hand-curated override map. filter-repo wraps the callback
# string in a generated function so `__file__` isn't available -- we
# walk up from cwd looking for the overrides file at a stable path.
_OVERRIDE_PATH = None
for _candidate in [
    os.path.join(os.getcwd(), "scripts", "commit-overrides.py"),
    os.path.join(os.getcwd(), "..", "scripts", "commit-overrides.py"),
    "scripts/commit-overrides.py",
]:
    if os.path.exists(_candidate):
        _OVERRIDE_PATH = _candidate
        break

_COMMIT_OVERRIDES = {}
if _OVERRIDE_PATH:
    _spec = importlib.util.spec_from_file_location("commit_overrides", _OVERRIDE_PATH)
    _mod = importlib.util.module_from_spec(_spec)
    _spec.loader.exec_module(_mod)
    _COMMIT_OVERRIDES = _mod.COMMIT_OVERRIDES


def _strip_trailers(body: str) -> str:
    cleaned = []
    for ln in body.splitlines():
        lower = ln.lower()
        if any(marker in lower for marker in BAD_TRAILERS):
            continue
        cleaned.append(ln)
    return "\n".join(cleaned).strip()


def commit_callback(commit, _metadata):
    raw = commit.message.decode("utf-8", errors="replace")
    lines = raw.split("\n")
    if not lines:
        return

    subject = lines[0]
    body = "\n".join(lines[1:]).strip()

    # Merge commits stay alone.
    if commit.parents and len(commit.parents) > 1:
        return

    # Look up the override by short SHA. filter-repo's commit.original_id
    # is the full 40-char hex; we use the first 7 chars to match git's
    # default short-hash format.
    short_hash = commit.original_id.decode("ascii")[:7]
    if short_hash in _COMMIT_OVERRIDES:
        override = _COMMIT_OVERRIDES[short_hash]
        if override:
            new_msg = f"{subject}\n\n{override}\n"
        elif body:
            new_msg = f"{subject}\n"
        else:
            return  # already empty - no-op
        commit.message = new_msg.encode("utf-8")
        return

    # Fallback for commits that aren't in the override map (shouldn't
    # happen since the agent covered all 200, but newer commits added
    # after the dump need handling too).
    body_lines = len(body.splitlines()) if body else 0
    has_trailer = any(m in body.lower() for m in BAD_TRAILERS)

    if body_lines <= KEEP_AS_IS_LINES and not has_trailer:
        return

    if body_lines > KEEP_AS_IS_LINES:
        new_msg = f"{subject}\n"
    else:
        cleaned_body = _strip_trailers(body)
        new_msg = f"{subject}\n\n{cleaned_body}\n" if cleaned_body else f"{subject}\n"

    commit.message = new_msg.encode("utf-8")
