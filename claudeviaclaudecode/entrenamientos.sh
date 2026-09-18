#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  entrenamientos.sh
#  Pasa los planes de entrenamiento de Romina Garino a Claude Code
#  Uso: bash entrenamientos.sh [--plan 1|2|3|all] ["prompt adicional"]
# ─────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLANES_FILE="$SCRIPT_DIR/planes_entrenamiento.md"

# ── Colores ──
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

usage() {
  echo -e "${BOLD}Uso:${RESET}"
  echo "  bash entrenamientos.sh [--plan 1|2|3|all] [\"prompt adicional\"]"
  echo ""
  echo -e "${BOLD}Ejemplos:${RESET}"
  echo "  bash entrenamientos.sh                              # todos los planes"
  echo "  bash entrenamientos.sh --plan 1                    # solo Home Básico"
  echo "  bash entrenamientos.sh --plan 2 \"adaptá el día 4\" # con instrucción extra"
  echo "  bash entrenamientos.sh --plan all --print          # imprime sin abrir claude"
  echo ""
  exit 0
}

# ── Defaults ──
PLAN="all"
EXTRA_PROMPT=""
PRINT_ONLY=false

# ── Args ──
while [[ $# -gt 0 ]]; do
  case "$1" in
    --plan) PLAN="$2"; shift 2 ;;
    --print) PRINT_ONLY=true; shift ;;
    --help|-h) usage ;;
    *) EXTRA_PROMPT="$1"; shift ;;
  esac
done

# ── Verificar archivo de planes ──
if [[ ! -f "$PLANES_FILE" ]]; then
  echo -e "${RED}Error: No se encontró planes_entrenamiento.md en $SCRIPT_DIR${RESET}"
  echo "Asegurate de que el archivo está en la misma carpeta que este script."
  exit 1
fi

# ── Extraer sección según plan ──
extract_plan() {
  local num="$1"
  case "$num" in
    1) grep -A 9999 "## PLAN 1" "$PLANES_FILE" | grep -B 9999 "^---$" | head -n -1 ;;
    2) grep -A 9999 "## PLAN 2" "$PLANES_FILE" | sed '/^## PLAN 3/q' | head -n -1 ;;
    3) grep -A 9999 "## PLAN 3" "$PLANES_FILE" ;;
    all) cat "$PLANES_FILE" ;;
  esac
}

# ── Nombres de planes ──
plan_name() {
  case "$1" in
    1) echo "Home Básico (3 días, sin equipamiento)" ;;
    2) echo "Home Pro (4 días, bandas + soga)" ;;
    3) echo "Battle Fox Online (6 días, avanzado)" ;;
    all) echo "todos los planes (Básico + Pro + Battle Fox)" ;;
  esac
}

# ── Contenido ──
CONTENIDO="$(extract_plan "$PLAN")"
NOMBRE="$(plan_name "$PLAN")"

# ── Prompt base ──
PROMPT="Tenés el siguiente plan de entrenamiento de Romina Garino (rominagarino.com): ${NOMBRE}.

---
${CONTENIDO}
---

${EXTRA_PROMPT}"

# ── Modo print ──
if [[ "$PRINT_ONLY" == true ]]; then
  echo -e "${CYAN}── PROMPT A ENVIAR ──${RESET}"
  echo "$PROMPT"
  exit 0
fi

# ── Verificar que claude esté instalado ──
if ! command -v claude &>/dev/null; then
  echo -e "${YELLOW}claude CLI no encontrado. Instalalo con:${RESET}"
  echo "  npm install -g @anthropic-ai/claude-code"
  echo ""
  echo -e "${CYAN}Mostrando el prompt que se enviaría:${RESET}"
  echo "$PROMPT"
  exit 0
fi

# ── Enviar a Claude Code ──
echo -e "${GREEN}Enviando ${BOLD}${NOMBRE}${RESET}${GREEN} a Claude Code...${RESET}"
echo ""
echo "$PROMPT" | claude
