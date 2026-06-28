#!/usr/bin/env bash
set -euo pipefail

MCP_NAME="${MCP_NAME:-notebooklm}"
NOTEBOOKLM_URL="${NOTEBOOKLM_URL:-https://notebooklm.google.com/}"
CHROME_APP="${CHROME_APP:-Google Chrome}"
CHROME_PROFILE_DIRECTORY="${CHROME_PROFILE_DIRECTORY:-}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
DIST_INDEX="${REPO_ROOT}/dist/index.js"

say() {
  printf '%s\n' "$*"
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    say "Missing command: $1"
    exit 1
  fi
}

open_notebooklm_in_chrome() {
  if [[ "$(uname -s)" != "Darwin" ]]; then
    say "Skipping Chrome launch: this helper opens Chrome automatically on macOS only."
    say "Open this URL in the Chrome profile that already has the Codex extension:"
    say "  ${NOTEBOOKLM_URL}"
    return
  fi

  if [[ -n "${CHROME_PROFILE_DIRECTORY}" ]]; then
    say "Opening NotebookLM in Chrome profile: ${CHROME_PROFILE_DIRECTORY}"
    if ! open -na "${CHROME_APP}" --args --profile-directory="${CHROME_PROFILE_DIRECTORY}" "${NOTEBOOKLM_URL}"; then
      say "Could not open ${CHROME_APP}. Open this URL in the Chrome profile that already has the Codex extension:"
      say "  ${NOTEBOOKLM_URL}"
    fi
  else
    say "Opening NotebookLM in the currently active Chrome profile."
    if ! open -a "${CHROME_APP}" "${NOTEBOOKLM_URL}"; then
      say "Could not open ${CHROME_APP}. Open this URL in the Chrome profile that already has the Codex extension:"
      say "  ${NOTEBOOKLM_URL}"
    fi
  fi
}

need_cmd node
need_cmd npm
need_cmd codex

cd "${REPO_ROOT}"

say "Building local NotebookLM MCP server..."
npm run build

if [[ ! -x "${DIST_INDEX}" ]]; then
  say "Build finished, but ${DIST_INDEX} is not executable."
  exit 1
fi

EXPECTED_JSON="{\"command\":\"node\",\"args\":[\"${DIST_INDEX}\"]}"

say "Checking Codex MCP entry: ${MCP_NAME}"
CURRENT_JSON="$(codex mcp get "${MCP_NAME}" --json 2>/dev/null || true)"

if [[ -n "${CURRENT_JSON}" ]] && node -e '
const current = JSON.parse(process.argv[1]);
const expected = JSON.parse(process.argv[2]);
const transport = current.transport || current;
process.exit(transport.command === expected.command && JSON.stringify(transport.args || []) === JSON.stringify(expected.args) ? 0 : 1);
' "${CURRENT_JSON}" "${EXPECTED_JSON}"; then
  say "Codex MCP entry already points to this local build."
else
  if [[ -n "${CURRENT_JSON}" ]]; then
    say "Updating existing Codex MCP entry."
    codex mcp remove "${MCP_NAME}" >/dev/null
  else
    say "Adding Codex MCP entry."
  fi

  codex mcp add "${MCP_NAME}" -- node "${DIST_INDEX}" >/dev/null
fi

say "Registered MCP:"
codex mcp get "${MCP_NAME}"

open_notebooklm_in_chrome

say ""
say "Done."
say "Important: do not run setup_auth for this workflow. That opens the MCP server's separate browser profile."
say "After this, restart or refresh Codex so the ${MCP_NAME} MCP tools are loaded in the current session."
