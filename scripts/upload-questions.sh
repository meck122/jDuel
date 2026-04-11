#!/usr/bin/env bash
# Upload a questions CSV file to the Oracle VM for later import.
#
# Usage:
#   ./scripts/upload-questions.sh /path/to/questions.csv [--key /path/to/key.pem]
#
# The CSV is placed at ~/questions-import.csv on the remote host.
# After uploading, run on the VM:
#   ./deploy.sh --import-questions
#
# Connection settings (in order of precedence):
#   1. Environment variables: JDUEL_SSH_HOST, JDUEL_SSH_USER
#   2. deploy/.env file in the repo root

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/deploy/.env"

# ── Parse arguments ──────────────────────────────────────────────────────────
LOCAL_CSV=""
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
      if [[ -z "$LOCAL_CSV" ]]; then
        LOCAL_CSV="$1"
      else
        echo "Unexpected argument: $1" >&2
        exit 1
      fi
      shift
      ;;
  esac
done

if [[ -z "$LOCAL_CSV" ]]; then
  echo "Usage: $0 /path/to/questions.csv [--key /path/to/key.pem]" >&2
  echo "" >&2
  echo "Connection: set JDUEL_SSH_HOST and JDUEL_SSH_USER in env or deploy/.env" >&2
  exit 1
fi

if [[ ! -f "$LOCAL_CSV" ]]; then
  echo "Error: CSV file not found: $LOCAL_CSV" >&2
  exit 1
fi

# ── Load connection settings ─────────────────────────────────────────────────
if [[ -z "$JDUEL_SSH_HOST" || -z "$JDUEL_SSH_USER" ]] && [[ -f "$ENV_FILE" ]]; then
  # shellcheck source=/dev/null
  source "$ENV_FILE"
fi

if [[ -z "$JDUEL_SSH_HOST" ]]; then
  echo "Error: JDUEL_SSH_HOST is not set." >&2
  echo "  Set it in your environment or in deploy/.env (see deploy/.env.example)" >&2
  exit 1
fi

if [[ -z "$JDUEL_SSH_USER" ]]; then
  JDUEL_SSH_USER="ubuntu"
  echo "JDUEL_SSH_USER not set, defaulting to: $JDUEL_SSH_USER"
fi

# Use key from env var if --key not given
if [[ -z "$SSH_KEY" && -n "$JDUEL_SSH_KEY" ]]; then
  SSH_KEY="$JDUEL_SSH_KEY"
fi

# ── Build SCP command ─────────────────────────────────────────────────────────
SCP_OPTS=(-o StrictHostKeyChecking=accept-new)
if [[ -n "$SSH_KEY" ]]; then
  SCP_OPTS+=(-i "$SSH_KEY")
fi

REMOTE="$JDUEL_SSH_USER@$JDUEL_SSH_HOST"
REMOTE_PATH="~/questions-import.csv"

echo "Uploading $LOCAL_CSV → $REMOTE:$REMOTE_PATH ..."
scp "${SCP_OPTS[@]}" "$LOCAL_CSV" "$REMOTE:$REMOTE_PATH"
echo "Done. To import on the VM, run: ./deploy.sh --import-questions"
