# Handoff - 2026-10-15, project closed

## Result
Proofolio won **1st place in the Promtal track** at Tri-City AI-Thon 2026 (Centle India, 10–11 Oct 2026). The project is finished; no further work is planned.

## Where everything is
- Code (public): https://github.com/samarthputhraya/verifiedbuild-api. `main` is pushed and clean.
- Android app (public): https://github.com/trulyayush/Proofolio-App (Ayush; renamed from `KITSW`).
- Pitch script: `docs/pitch.md` (final, every number sourced in section 7). Deck: Slides artifact https://claude.ai/artifact/ELpZKHRjXRVfyamkg2jGen.
- Demo video: `C:\Users\samar\OneDrive\Documents\Proofolio-demo-2min.mp4` (2:24, the final cut; the earlier 2:33 cut is `Proofolio-demo.mp4`). Source in `video/`, re-render assets in `C:\Users\samar\OneDrive\Documents\proofolio-work\`.
- Submission ZIP: `C:\Users\samar\OneDrive\Documents\Proofolio-source.zip` (built with `git archive` from the 11 Oct 08:34 commit).

## Live service: down since 15 Oct ~15:10 IST
- https://verifiedbuild-api-215071922486.asia-south1.run.app returns 503: "billing is disabled for this project". The billing account "My Billing Account" (`011EEC-50FDC1-6523D2`) shows `open: False`: Google suspended it on 14 Oct for a past-due payment (emails from 7 Oct on said "past due or invalid payment information"). The emails give 30 days, until about 13 Nov, to pay before the billing account and its projects are terminated. Whether the $300 trial credit is used up is visible only in the console (Billing → Credits). The other services in the same project are affected too (`gurugraph-web`, `aarogya-grid` and `lunaxx` logged the same error).
- To bring it back: reopen or replace the billing account in the Google Cloud console, then run
  `gcloud run services update verifiedbuild-api --region asia-south1 --min-instances 0`
  so it costs nothing while idle (it is still set to 1, the judging setting; the update was refused while billing was closed).
- To shut it down for good instead: `gcloud run services delete verifiedbuild-api --region asia-south1`, and pause the Supabase project.

## Loose ends (only SAM can do these)
- The service's `GITHUB_TOKEN` is SAM's classic `gh` token with repo scope. Revoke it or replace it with a fine-grained public-read token.
- The admin passcode was used on stage. Change `ADMIN_KEY` in `.env` and redeploy (`scripts\deploy.ps1`) if the service comes back.
- The live database held 6 listings, 4 labelled samples and a few test sign-ups on 11 Oct, plus whatever the demo added (not checked: the service is down).

## The method, for the next hackathon
Saved as the global skill `~/.claude/skills/hackathon-playbook/SKILL.md`, and the global `~/.claude/CLAUDE.md` points to it. The kit in `Downloads\tricity-setup` installs it too.
