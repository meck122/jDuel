# Auto-Deploy Setup

One-time configuration to wire GitHub Actions auto-deploy to the Oracle VPS.
Plan: [`docs/plans/2026-05-15-001-feat-auto-deploy-on-merge-plan.md`](../docs/plans/2026-05-15-001-feat-auto-deploy-on-merge-plan.md).

Run this sequence end-to-end before merging U4 (the deploy job). Steps 1–9
configure the trust chain; step 10 verifies it works; steps 11–15 stage the
workflow code in.

> Throughout: `<DEPLOY_HOST>` is the VPS hostname or IP. Substitute as you go.

---

## 1. Enable branch protection on `main`

GitHub → Settings → Branches → Branch protection rules → Add rule

- Branch name pattern: `main`
- ✅ Require a pull request before merging (1 approval)
- ❌ Required status checks (leave empty for now — we'll add `ci` after step 10)
- ✅ Do not allow bypassing the above settings
- ❌ Allow force pushes
- ❌ Allow deletions

> Solo-dev limitation: GitHub requires PR review by someone other than the author.
> If you want a hard gate, use a second GitHub account; otherwise enable "Require
> a pull request before merging" without "Require approvals" so you can self-merge.

## 2. Verify GitHub notification settings

GitHub → Settings (personal) → Notifications → Actions

- ✅ Failed workflows: email me

This is how deploy failures reach you.

## 3. Generate the deploy keypair locally

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/jduel_deploy -N ""
```

Result: `~/.ssh/jduel_deploy` (private) and `~/.ssh/jduel_deploy.pub` (public).

Do not reuse your personal SSH key. The deploy key is dedicated so it can be
revoked independently.

## 4. Install the public key on the VPS

```bash
cat ~/.ssh/jduel_deploy.pub | ssh ubuntu@<DEPLOY_HOST> \
  "cat >> ~/.ssh/authorized_keys"
```

> No `command="..."` restriction in v1 — `appleboy/ssh-action` runs multi-line
> scripts. **Acknowledged trust-base:** this key grants full shell as `ubuntu`.
> Sudoers (step 7) scopes root escalation, not arbitrary code execution as the
> service user. Rotation procedure is below (step 9).

## 5. Verify the box can `git fetch` non-interactively

The GHA SSH script will run `git fetch origin main && git reset --hard
origin/main` as `ubuntu`. Confirm this already works:

```bash
ssh ubuntu@<DEPLOY_HOST> 'cd /home/ubuntu/dev/jDuel && git fetch origin main'
```

Should succeed with no password prompt. If it fails:
- **Public repo:** check the remote is HTTPS, not git@. If git@, swap to HTTPS
  (`git remote set-url origin https://github.com/meck122/jDuel.git`).
- **Private repo:** install a GitHub deploy key for `ubuntu` (separate from the
  Actions key above), or cache an HTTPS PAT in `~/.git-credentials`.

## 6. Create the lockfile

```bash
ssh ubuntu@<DEPLOY_HOST> 'sudo install -m 0644 -o root -g root /dev/null /var/run/jduel-deploy.lock'
```

`deploy.sh` uses `flock` against this path. Owning it as root prevents symlink
attacks; world-readable is needed because `flock` opens it.

## 7. Install the scoped sudoers entry

From your laptop, after pulling the latest `main`:

```bash
# Copy the template to the box
scp deploy/sudoers.d/jduel-deploy ubuntu@<DEPLOY_HOST>:/tmp/jduel-deploy.sudoers

# On the box: validate, then install
ssh ubuntu@<DEPLOY_HOST>
  sudo visudo -cf /tmp/jduel-deploy.sudoers
  sudo install -m 0440 -o root -g root /tmp/jduel-deploy.sudoers /etc/sudoers.d/jduel-deploy
  rm /tmp/jduel-deploy.sudoers
```

`visudo -cf` fails on syntax error. **Never** edit `/etc/sudoers.d/jduel-deploy`
in-place without `visudo` — a syntax error there locks you out of `sudo`.

### Verify the paths match the box

```bash
ssh ubuntu@<DEPLOY_HOST>
  readlink -f /bin/systemctl   # expect /usr/bin/systemctl
  readlink -f /bin/cp           # expect /usr/bin/cp
  readlink -f /bin/chown        # expect /usr/bin/chown
  readlink -f /bin/chmod        # expect /usr/bin/chmod
  readlink -f /bin/rm           # expect /usr/bin/rm
```

If any return `/bin/...` instead of `/usr/bin/...` (older distros), update
`deploy/sudoers.d/jduel-deploy` to use the actual path and reinstall.

## 8. Add GitHub repository secrets

GitHub → Settings → Secrets and variables → Actions → New repository secret

| Name              | Value                                                                |
|-------------------|----------------------------------------------------------------------|
| `DEPLOY_SSH_KEY`  | Full contents of `~/.ssh/jduel_deploy` (incl. `-----BEGIN/END-----`) |
| `DEPLOY_HOST`     | The VPS hostname or IP                                               |
| `DEPLOY_USER`     | `ubuntu`                                                             |

After saving, you can see the secret names (but not values) under the same
page.

## 9. Rotation procedure

Rotate the deploy key:
- On any suspected exposure (lost laptop, leaked workflow log, ex-collaborator)
- Annually as a hygiene cadence

Steps:
1. Generate a new keypair (step 3) under a new filename (e.g., `jduel_deploy_2027`).
2. Append the new public key to `authorized_keys` on the VPS (step 4).
3. Update the `DEPLOY_SSH_KEY` GitHub secret with the new private key (step 8).
4. Trigger a `workflow_dispatch` run from the Actions UI to verify the new key
   works end-to-end.
5. Remove the **old** public key from `~ubuntu/.ssh/authorized_keys` on the VPS.

The order matters: install before remove, so a misconfiguration doesn't lock
out the pipeline.

## 10. End-to-end verification

Before merging U4, confirm the trust chain holds:

```bash
ssh -i ~/.ssh/jduel_deploy ubuntu@<DEPLOY_HOST> \
  'cd /home/ubuntu/dev/jDuel && ./deploy.sh --dry-run'
```

Expected output:
- `✓ flock present`
- `✓ lockfile exists`
- `✓ sudoers OK`
- `✓ dry-run OK — exit 0 (no production effects)`

If any line is missing or shows a `❌`, fix the underlying issue and retry
before proceeding. `--dry-run` does not touch the backend, build anything, or
acquire the lock; it is safe to run repeatedly.

## 11. Merge U1 (the workflow scaffold)

The PR introducing this work merges U1 first. After the merge to `main`, the
`ci` job runs against `main` for the first time. Expect possible iteration
here — runner-specific issues (cache misses, model download timeouts) may
surface that didn't happen locally.

## 12. Add `ci` as a required status check

After at least one green `ci` run on `main`:

GitHub → Settings → Branches → `main` rule → Required status checks → add `ci`.

This closes the test-bypass loophole that existed during step 11.

## 13. Merge U2 (deploy.sh hardening)

After merging, manually run `./deploy.sh` on the box once to confirm no regression
vs the prior behavior. The new flock, EXIT trap, and dirty-tree guard should be
invisible on the happy path.

## 14. Merge U4 (the deploy job)

This is the unit that enables auto-deploy. From the Actions UI, manually trigger
a `workflow_dispatch` run on `deploy.yml` once before relying on automatic
firing — this verifies the SSH path end-to-end on production data.

## 15. Merge U5 (docs)

Finalize the doc updates. `docs/DeploymentGuide.md` should now describe
auto-deploy as the default and manual `./deploy.sh` as the emergency fallback.

---

## Troubleshooting

### `sudo -n` fails for some command in `deploy.sh`

- Re-run `./deploy.sh --dry-run` to identify the missing entry.
- Compare `deploy/sudoers.d/jduel-deploy` against actual `sudo` calls:
  ```bash
  grep -oE 'sudo -n [^|"$]+' deploy.sh
  ```
- Update the template, reinstall via `visudo -cf` + `install`.

### A deploy hung mid-flight

- The U2 EXIT trap restarts `jduel-backend` on any non-zero exit, so the site
  should be up on the prior code.
- Check the workflow log for the failing step.
- SSH in: `journalctl -u jduel-backend -f` for backend logs.
- Lock cleanup: `flock` releases the lock when the holding process exits, so a
  hung process must be killed (`ps + kill`) to free it. Reboot also clears.

### "Working tree has uncommitted changes" on auto-deploy

This means someone edited a file on the box without committing. The U2 dirty-tree
guard correctly rejected the deploy. Resolution:
1. SSH in and `git status` to see what changed.
2. Either commit the hotfix to a branch + PR + merge (preferred), or
3. Discard with `git checkout -- <file>` if the change is not wanted, then
   re-trigger the deploy via `workflow_dispatch`.

The escape hatch `./deploy.sh --force-dirty` exists for genuine emergencies
where the box state is the source of truth.

### Rollback

Revert the offending merge commit on `main`:

```bash
git revert <bad-sha> && git push origin main
```

The next auto-deploy restores prior behavior. For true emergencies where GHA
itself is broken, SSH in and:

```bash
cd /home/ubuntu/dev/jDuel
git reset --hard <known-good-sha>
./deploy.sh
```
