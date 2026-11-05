#!/bin/sh
# Gera o env.js quando o container sobe (o nginx roda os scripts de /docker-entrypoint.d/).
# Faz o mesmo que o gerar-env.js, mas lendo as variáveis do container (env_file: .env).
# O arquivo vai para /tmp porque a pasta do site não é gravável pelo usuário do nginx.
set -eu

for chave in SUPABASE_URL WEBHOOK_URL; do
    eval "valor=\${$chave:-}"
    if [ -z "$valor" ]; then
        echo "gerar-env: falta $chave no .env do deploy" >&2
        exit 1
    fi
done

# Escapa \ e " para o valor caber numa string JSON
json() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

cat > /tmp/env.js <<EOF
// Gerado no início do container por deploy/gerar-env.sh. Não edite.
window.ENV = {
    "SUPABASE_URL": "$(json "$SUPABASE_URL")",
    "WEBHOOK_URL": "$(json "$WEBHOOK_URL")"
};
EOF

echo "gerar-env: env.js gerado"
