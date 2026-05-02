#!/usr/bin/env python
"""
One-shot rewrite that does two things at once:

1. Scrubs personal emails ([redacted], [redacted])
   from every blob AND every commit message in the repo's history.

2. Trims AI-flavoured long commit bodies — anything over 3 body lines
   gets its body dropped (keep the subject only); AI trailers like
   "Co-Authored-By: Claude" / "Generated with" / robot emoji get
   stripped wherever they appear.

Run from the repo root:
  python scripts/sanitize-and-cleanup.py

Then force-push:
  git push origin main --force-with-lease

Preserves AuthorDate + CommitDate. Merge commits are left alone.
"""
import git_filter_repo as fr

# ───────────────────────── email scrub ─────────────────────────

EMAILS_TO_SCRUB = [
    b"[redacted]",
    b"[redacted]",
]
REDACTED = b"[redacted]"


def scrub_emails(data: bytes) -> bytes:
    out = data
    for email in EMAILS_TO_SCRUB:
        out = out.replace(email, REDACTED)
    return out


def blob_callback(blob, _meta):
    blob.data = scrub_emails(blob.data)


# ───────────────────────── message cleanup ─────────────────────────

KEEP_AS_IS_LINES = 3
BAD_TRAILERS = (
    "co-authored-by: claude",
    "generated with",
    "🤖",
)


def strip_trailers(body: str) -> str:
    cleaned = []
    for ln in body.splitlines():
        if any(marker in ln.lower() for marker in BAD_TRAILERS):
            continue
        cleaned.append(ln)
    return "\n".join(cleaned).strip()


def commit_callback(commit, _meta):
    # Email scrub on the commit message itself.
    commit.message = scrub_emails(commit.message)

    if commit.parents and len(commit.parents) > 1:
        # Leave merge commits alone — rewriting their bodies is rarely
        # what you want and complicates rebase tools.
        return

    raw = commit.message.decode("utf-8", errors="replace")
    lines = raw.split("\n")
    if not lines:
        return
    subject = lines[0]
    body = "\n".join(lines[1:]).strip()
    body_lines = len(body.splitlines()) if body else 0
    has_trailer = any(m in body.lower() for m in BAD_TRAILERS)

    if body_lines <= KEEP_AS_IS_LINES and not has_trailer:
        return  # short + clean — keep verbatim

    if body_lines > KEEP_AS_IS_LINES:
        # Long body → drop entirely so commits read like one-line
        # diffs (subject only).
        new_msg = f"{subject}\n"
    else:
        # Short body but has an AI trailer → keep the body minus the
        # trailer.
        cleaned = strip_trailers(body)
        new_msg = f"{subject}\n\n{cleaned}\n" if cleaned else f"{subject}\n"

    commit.message = new_msg.encode("utf-8")


def main():
    args = fr.FilteringOptions.parse_args(["--force"])
    filt = fr.RepoFilter(
        args,
        blob_callback=blob_callback,
        commit_callback=commit_callback,
    )
    filt.run()


if __name__ == "__main__":
    main()
