#!/usr/bin/env bash
# Runs both the backend (http://localhost:4000) and frontend (http://localhost:5173)
# dev servers together. Ctrl+C stops both.
set -e

cleanup() {
  echo "Stopping..."
  kill 0
}
trap cleanup EXIT INT TERM

(cd backend && npm run dev) &
(cd frontend && npm run dev) &

wait
