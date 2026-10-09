# Deploy the last commit (not uncommitted edits) to Cloud Run, with settings from .env.
# Usage, from the repo root:  powershell -File scripts\deploy.ps1
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

python scripts\env_to_yaml.py

# Without Supabase the app keeps data in memory, which only works with a single instance.
$supabase = (Select-String -Path .env -Pattern '^SUPABASE_URL=.+' -Quiet)
$maxInstances = if ($supabase) { 3 } else { 1 }

$zip = Join-Path $env:TEMP "verifiedbuild-deploy.zip"
$dir = Join-Path $env:TEMP "verifiedbuild-deploy"
Remove-Item -Recurse -Force $dir, $zip -ErrorAction SilentlyContinue
git archive --format=zip -o $zip HEAD
Expand-Archive $zip -DestinationPath $dir

gcloud run deploy verifiedbuild-api --source $dir --region asia-south1 --allow-unauthenticated `
  --timeout 300 --memory 1Gi --cpu 1 --min-instances 1 --max-instances $maxInstances `
  --env-vars-file env.yaml --quiet
