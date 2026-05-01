# Phase 38 - one-shot commit history cleanup runner (PowerShell version).
#
# Usage:
#   PS> cd "D:/CPE 241 Product build Present/metu"
#   PS> .\scripts\run-commit-cleanup.ps1
#
# What it does:
#   1. Verifies the safety tag exists (creates if missing).
#   2. Shows preview of first 5 commits that would change.
#   3. Asks for explicit "YES" to proceed.
#   4. Runs git filter-repo with the subject-only callback.
#   5. Shows the new log so you can verify.
#   6. Asks for explicit "YES" before force-pushing.
#
# Rollback after running:
#   git reset --hard pre-commit-cleanup-2026-04-30
#   git push --force-with-lease origin main

$ErrorActionPreference = "Stop"

# Move to repo root regardless of where the script was launched from.
Set-Location (Join-Path $PSScriptRoot "..")

Write-Host ""
Write-Host "=== Phase 38 commit history cleanup ===" -ForegroundColor Green

# 1. Backup tag
$tagExists = $false
try {
    git rev-parse pre-commit-cleanup-2026-04-30 *> $null
    if ($LASTEXITCODE -eq 0) { $tagExists = $true }
} catch { $tagExists = $false }

if ($tagExists) {
    Write-Host "OK Backup tag exists: pre-commit-cleanup-2026-04-30" -ForegroundColor Green
} else {
    Write-Host "  Creating backup tag..." -ForegroundColor Yellow
    git tag pre-commit-cleanup-2026-04-30 main
    git push origin pre-commit-cleanup-2026-04-30
    Write-Host "OK Backup tag created + pushed" -ForegroundColor Green
}

# 2. Preview
Write-Host ""
Write-Host "=== Preview (first 5 commits that will change) ===" -ForegroundColor Yellow
node scripts/preview-commit-cleanup.mjs --changed-only --limit 5

Write-Host ""
Write-Host "Total summary:" -ForegroundColor Yellow
$summary = node scripts/preview-commit-cleanup.mjs 2>&1 | Select-Object -Last 1
Write-Host $summary

# 3. Confirm rewrite
Write-Host ""
Write-Host "This rewrites every commit's SHA on main." -ForegroundColor Red
Write-Host "AuthorDate + CommitDate are preserved (your timestamps don't shift)." -ForegroundColor DarkGray
Write-Host "Code is untouched - only commit messages change." -ForegroundColor DarkGray
Write-Host ""

$confirm = Read-Host "Type YES to run filter-repo"
if ($confirm -ne "YES") {
    Write-Host "Aborted." -ForegroundColor Red
    exit 0
}

# 4. Run rewrite
Write-Host ""
Write-Host "Running git filter-repo via Python wrapper..." -ForegroundColor Yellow

# We can't pass the multi-line Python callback via PowerShell -- the
# argument parser splits on quotes and breaks the script. Use the
# wrapper at scripts/run-filter-repo.py which imports git-filter-repo
# as a library + applies the callback directly.
python scripts/run-filter-repo.py

if ($LASTEXITCODE -ne 0) {
    Write-Host "filter-repo failed." -ForegroundColor Red
    exit 1
}

# 5. Verify
Write-Host ""
Write-Host "=== After rewrite (top 10 commits) ===" -ForegroundColor Green
git log --oneline | Select-Object -First 10

Write-Host ""
Write-Host "If anything looks wrong, rollback with:" -ForegroundColor Yellow
Write-Host "  git reset --hard pre-commit-cleanup-2026-04-30"
Write-Host "  git push --force-with-lease origin main"
Write-Host ""

# 6. Confirm push
$confirm2 = Read-Host "Type YES to force-push to origin/main"
if ($confirm2 -ne "YES") {
    Write-Host "Local rewrite kept. Push later with: git push --force-with-lease origin main" -ForegroundColor Yellow
    exit 0
}

git push --force-with-lease origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "OK History rewritten + pushed." -ForegroundColor Green
} else {
    Write-Host "Push failed - history is rewritten locally but not on origin." -ForegroundColor Red
    Write-Host "Try again: git push --force-with-lease origin main"
}
