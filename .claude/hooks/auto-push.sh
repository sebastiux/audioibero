#!/usr/bin/env bash
# Hook Stop: al terminar cada turno, hace commit de cambios pendientes y push de la rama actual.
cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}" || exit 0
branch=$(git symbolic-ref --short HEAD 2>/dev/null) || exit 0

if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -q -m "chore: guardar cambios automáticamente" || exit 0
fi

# Nada que subir si el remoto ya está al día.
if git rev-parse --verify -q "origin/$branch" >/dev/null && [ -z "$(git log "origin/$branch..HEAD" --oneline)" ]; then
  exit 0
fi

for delay in 0 2 4 8 16; do
  sleep "$delay"
  if git push -q -u origin "$branch" 2>/dev/null; then
    echo "{\"systemMessage\": \"Push automático a $branch\"}"
    exit 0
  fi
done
echo "{\"systemMessage\": \"Falló el push automático a $branch\"}"
