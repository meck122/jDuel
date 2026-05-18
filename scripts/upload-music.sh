#!/usr/bin/env bash
# Upload local music assets to the Oracle VM for use in production builds.
#
# Music .mp3 files are not tracked in git (see .gitignore). This script
# rsyncs a local directory of .mp3 files to the build path on the VPS so
# that a subsequent deploy (with MUSIC_ENABLED=true) bundles them.
#
# Usage:
#   ./scripts/upload-music.sh [/path/to/local/music/dir] [--key /path/to/key.pem]
#
# Defaults:
#   Local source : ./frontend/src/assets/music/   (repo-relative)
#   Remote dest  : ~/dev/jDuel/frontend/src/assets/music/
#
# ⚠️  FIRST PULL WARNING (one-time, after the git rm commit):
#   On the VPS, run this BEFORE git pull to preserve the tracked files:
#     cp -r ~/dev/jDuel/frontend/src/assets/music ~/jduel-music-backup/
#   After the pull removes them, restore via:
#     ./scripts/upload-music.sh ~/jduel-music-backup/
#
# Connection settings (in order of precedence):
#   1. Environment variables: JDUEL_SSH_HOST, JDUEL_SSH_USER, JDUEL_SSH_KEY
#   2. scripts/.env file (same directory as this script)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

# ── Parse arguments ───────────────────────────────────────────────────────────
LOCAL_DIR=""
SSH_KEY=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --key)
      SSH_KEY="$2"
      shift 2
      ;;
    --key=*)
      SSH_KEY="${1#--key=}"
      shift
      ;;
    -*)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
    *)
      if [[ -z "$LOCAL_DIR" ]]; then
        LOCAL_DIR="$1"
      else
        echo "Unexpected argument: $1" >&2
        exit 1
      fi
      shift
      ;;
  esac
done

# Default source: repo's own music dir
if [[ -z "$LOCAL_DIR" ]]; then
  LOCAL_DIR="$REPO_ROOT/frontend/src/assets/music"
fi

if [[ ! -d "$LOCAL_DIR" ]]; then
  echo "Error: directory not found: $LOCAL_DIR" >&2
  exit 1
fi

# Refuse to upload if there are no .mp3 files in the source dir
MP3_COUNT=$(find "$LOCAL_DIR" -maxdepth 1 -name "*.mp3" | wc -l)
if [[ "$MP3_COUNT" -eq 0 ]]; then
  echo "Error: no .mp3 files found in $LOCAL_DIR" >&2
  echo "  Nothing to upload. Add .mp3 files to the source directory first." >&2
  exit 1
fi
echo "Found $MP3_COUNT .mp3 file(s) in $LOCAL_DIR"

# ── Load connection settings ──────────────────────────────────────────────────
if [[ -z "$JDUEL_SSH_HOST" || -z "$JDUEL_SSH_USER" ]] && [[ -f "$ENV_FILE" ]]; then
  # shellcheck source=/dev/null
  source "$ENV_FILE"
fi

if [[ -z "$JDUEL_SSH_HOST" ]]; then
  echo "Error: JDUEL_SSH_HOST is not set." >&2
  echo "  Set it in your environment or in scripts/.env (see scripts/.env.example)" >&2
  exit 1
fi

if [[ -z "$JDUEL_SSH_USER" ]]; then
  JDUEL_SSH_USER="ubuntu"
  echo "JDUEL_SSH_USER not set, defaulting to: $JDUEL_SSH_USER"
fi

if [[ -z "$SSH_KEY" && -n "$JDUEL_SSH_KEY" ]]; then
  SSH_KEY="$JDUEL_SSH_KEY"
fi

# ── Build SSH/rsync options ───────────────────────────────────────────────────
SSH_OPTS="-o StrictHostKeyChecking=accept-new"
if [[ -n "$SSH_KEY" ]]; then
  SSH_OPTS="$SSH_OPTS -i $SSH_KEY"
fi

REMOTE="$JDUEL_SSH_USER@$JDUEL_SSH_HOST"
REMOTE_MUSIC_DIR="~/dev/jDuel/frontend/src/assets/music"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
REMOTE_BACKUP_DIR="~/jduel-music-backup-$TIMESTAMP"

# ── Backup existing remote files before overwriting ───────────────────────────
echo "Backing up existing remote music files to $REMOTE_BACKUP_DIR ..."
# shellcheck disable=SC2029
ssh $SSH_OPTS "$REMOTE" \
  "if ls $REMOTE_MUSIC_DIR/*.mp3 >/dev/null 2>&1; then
     cp -r $REMOTE_MUSIC_DIR $REMOTE_BACKUP_DIR
     echo 'Backup created at $REMOTE_BACKUP_DIR'
   else
     echo 'No existing .mp3 files on remote — skipping backup'
   fi"

# ── Rsync only .mp3 files (leaves tracks.ts and README.md alone) ───────────
echo "Uploading .mp3 files from $LOCAL_DIR → $REMOTE:$REMOTE_MUSIC_DIR ..."
rsync -av \
  -e "ssh $SSH_OPTS" \
  --include="*.mp3" \
  --exclude="*" \
  "$LOCAL_DIR/" \
  "$REMOTE:$REMOTE_MUSIC_DIR/"

echo ""
echo "Done. To enable music on the next deploy:"
echo "  1. Set MUSIC_ENABLED = true in frontend/src/config/features.ts"
echo "  2. Run ./deploy.sh"
