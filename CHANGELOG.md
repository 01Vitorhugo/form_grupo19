# Changelog

Mudanças do formulário de contato do Grupo19.
Formato [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), versões em [SemVer](https://semver.org/lang/pt-BR/).

## [Não lançado]

## [1.0.0] - 2026-11-05

Primeira versão numerada.

### Adicionado
- Deploy na VPS g19-apps-prod em `https://formulario.grupo19.app`: `Dockerfile` (nginx sem root),
  `compose.yaml` com as labels do Traefik, `deploy/nginx.conf`, `deploy/gerar-env.sh` e `docs/deploy.md`.
- O `env.js` é gerado quando o container sobe, a partir do `.env` do stack.

### Alterado
- A Edge Function `contato-enviar` passa a aceitar envios de `https://formulario.grupo19.app`.

### Já existia antes desta versão
- Formulário publicado no GitHub Pages, gravando no Supabase do Grupo19 (schema `contato`)
  pela Edge Function `contato-enviar` e enviando os dados para o webhook do n8n.

[Não lançado]: https://github.com/Grupo-19-Dev/form_grupo19/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Grupo-19-Dev/form_grupo19/releases/tag/v1.0.0
