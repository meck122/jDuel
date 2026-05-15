---
title: "Auto-deploy on merge to main (Oracle VPS)"
date: 2026-05-15
status: ready-for-planning
---

# Auto-deploy on Merge to Main (Oracle VPS)

## Problem

Every production deploy today is a manual ritual: SSH into the Oracle VPS, `git pull`, run `deploy.sh`. It works, but it's friction every time, and the deploy step gets skipped or delayed on small changes. There is no test gate — the script will happily deploy code that fails CI locally.

## Goal

Make merges to `main` deploy themselves, with tests as the gate. Manual SSH for routine deploys becomes unnecessary.

## What changes for the user (me)

- Open a PR, merge it, walk away. Tests run on GitHub Actions; on green, the Oracle VPS pulls and deploys automatically.
- Doc-only PRs (`docs/`, `CLAUDE.md`, brainstorms, README) merge cleanly without touching production.
- Deploy failures show up as a red email from GitHub Actions, with the full `deploy.sh` log inline.

## In Scope

- A GitHub Actions workflow on push-to-`main` that:
  1. Runs the existing pre-commit suite (ruff, pytest, mypy, prettier, eslint, tsc) as the test gate.
  2. On green AND if files under `frontend/`, `backend/`, `deploy/`, or `deploy.sh` itself changed, SSHes into the Oracle VPS and runs `git pull && ./deploy.sh`.
- Operational setup on the VPS:
  - A dedicated deploy user (or scoped SSH key on the existing user) with passwordless `sudo` limited to exactly the commands `deploy.sh` uses (`systemctl stop|start|reload`, `cp`, `chown`, `chmod`, `daemon-reload`, `rm` of frontend dist).
  - Public key from a freshly-generated keypair installed in that user's `authorized_keys`.
  - Private key stored as a GitHub Actions repository secret.
- GHA `concurrency` group on the deploy job so two back-to-back merges don't race two `deploy.sh` runs.
- Default GitHub email-on-failure notification.

## Out of Scope

- Migrating away from Oracle (Fly.io + Cloudflare Pages plan exists at `docs/plans/2026-02-18-feat-migrate-hosting-flyio-cloudflare-pages-plan.md` — explicitly *not* triggered by this brainstorm).
- Zero-downtime or blue-green deploys. `deploy.sh` still incurs ~2 min of player-facing downtime per deploy (backend stops so the Vite build can use its RAM on the 4 GB box). This is unchanged.
- Splitting frontend-only vs backend-only deploys to reduce downtime (parked as a possible follow-on).
- Rollback automation. Rollback procedure remains: revert the offending merge commit on `main`; the next auto-deploy restores prior behavior.
- PR preview environments.
- Slack/PagerDuty/SMS notifications. Email is enough for a solo dev.
- Auto-deploying non-`main` branches.

## Key Decisions

- **Mechanism: GitHub Actions → SSH (Approach A).** Conventional and debuggable. Considered self-hosted runner (B) and pull-based cron (C); rejected because B costs RAM on a 4 GB box and C's latency + observability cost isn't worth the marginal secrets-hygiene win for a single-VPS, solo-dev setup.
- **Trigger: every merge to `main`, fully hands-off, path-filtered.** No manual approval step. Path filter prevents doc-only merges from causing 2 minutes of downtime for changes that have no production effect.
- **Test gate: the existing `uvx pre-commit run --all-files`.** Reuses the same quality bar as local commits instead of inventing a parallel CI test definition that would drift out of sync.
- **SSH credentials: dedicated key, scoped user.** Not the personal SSH key. The deploy user gets `NOPASSWD` sudo for the specific commands `deploy.sh` needs, nothing else. This bounds blast radius if the GitHub secret leaks.
- **Concurrency: queue, don't race.** GHA `concurrency: deploy-prod, cancel-in-progress: false`. If a second merge lands mid-deploy, it queues and runs after.
- **Cost: $0 expected.** Public repo = unlimited GHA minutes. Private repo = 2000 free min/month; a 5-minute pipeline × 50 merges/month = 250 min, well under the cap.

## Assumptions

- The Oracle VPS is reachable on port 22 from GitHub Actions runner IPs. (Verify; Oracle Security List + iptables both need to allow inbound SSH from those IPs, or from `0.0.0.0/0` if we accept that exposure.)
- Pre-commit currently passes cleanly on `main`. (Verify before wiring CI as a gate — if it fails today, the first auto-deploy attempt will fail and we'll think the workflow is broken.)
- The current `deploy.sh` is idempotent enough to run unattended. (It uses `set -e`, verifies services post-start, and exits non-zero on failure — looks good, confirm during planning.)
- The repo is currently `meck122/jDuel` on GitHub; settings access is available for storing secrets.

## Open Questions for Planning

- Is the jDuel repo public or private? Affects the GHA free-tier math, but not the design.
- Should the SSH ingress be restricted to GitHub Actions' published IP range (regularly updated), or left open to `0.0.0.0/0` with key-only auth as the only protection? Trade-off: tighter ACL vs. operational toil keeping the allow-list current.
- Does `deploy.sh` need any modification to be runnable non-interactively as a non-`ubuntu` user (e.g., paths, ownership of `/home/ubuntu/dev/jDuel`)? Worth a dry-run during planning before assuming "just run it."

## Success Criteria

- Merging a code-only PR to `main` results in a deployed change at `jduel.xyz` within ~5 minutes, with no SSH session opened by me.
- Merging a doc-only PR to `main` does not touch production.
- A PR whose tests fail does not deploy; the failure is visible in GitHub's PR/check UI and in an email.
- A second merge during an in-flight deploy queues cleanly and runs after the first.

## Related Documents

- `deploy.sh` — the script being automated
- `docs/DeploymentGuide.md` — current manual deploy procedure
- `deploy/README.md` — Oracle VPS setup notes (iptables quirk, key paths)
- `docs/plans/2026-02-18-feat-migrate-hosting-flyio-cloudflare-pages-plan.md` — alternative path (not pursued here)
- `.pre-commit-config.yaml` — the test/lint suite that becomes the CI gate
