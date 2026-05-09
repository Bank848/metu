# Deploy the metu (Next.js web) app to Fly with NEXT_PUBLIC_* build args
# inlined from .env.deploy.local. PowerShell mirror of deploy-web.sh.
#
# Usage:
#   .\scripts\deploy-web.ps1
#
# See deploy-web.sh for the .env.deploy.local format.

$ErrorActionPreference = "Stop"
Set-Location -Path (Join-Path $PSScriptRoot "..")

if (-not (Test-Path ".env.deploy.local")) {
  Write-Error ".env.deploy.local not found. Create it from the template at the top of scripts/deploy-web.sh."
}

$args = @()
foreach ($line in Get-Content ".env.deploy.local") {
  $trimmed = $line.Trim()
  if ([string]::IsNullOrEmpty($trimmed)) { continue }
  if ($trimmed.StartsWith("#")) { continue }
  $args += "--build-arg"
  $args += $trimmed
}

Write-Host "-> flyctl deploy --remote-only -a metu (with $($args.Count / 2) build args)"
& flyctl deploy --config fly.toml --remote-only -a metu @args
