# Deploy na VPS — formulario.grupo19.app

O formulário roda na VPS **g19-apps-prod** (`159.195.8.21`) como um container nginx,
atrás do Traefik compartilhado, que emite o certificado HTTPS (Let's Encrypt).
O GitHub Pages (`https://grupo-19-dev.github.io/form_grupo19/`) continua publicando
em paralelo pelo Actions.

| | |
|---|---|
| Endereço | https://formulario.grupo19.app |
| Pasta na VPS | `/opt/docker/stacks/g19-formulario` (clone deste repositório) |
| Container | `g19-formulario` (nginx sem root, porta 8080) |
| DNS | registro `A` `formulario` → `159.195.8.21`, somente DNS (nuvem cinza) |
| Banco | nenhum direto: o envio vai para a Edge Function `contato-enviar` |

## Como funciona

- A imagem copia `formulario.html` (também como `index.html`), o CSS e os JS.
- Ao subir, `deploy/gerar-env.sh` gera o `env.js` com `SUPABASE_URL` e `WEBHOOK_URL`
  lidos do `.env` do stack. Trocar um valor = editar o `.env` e recriar o container.
- O nginx manda `Cache-Control: no-cache`: o navegador confere a cada visita se os
  arquivos mudaram, então um deploy novo aparece na hora.
- A Edge Function `contato-enviar` só aceita envios das origens da lista `ORIGENS`
  (em `supabase/functions/contato-enviar/index.ts`). `https://formulario.grupo19.app`
  está nela.

## Primeiro deploy (já feito em 05/11/2026)

```bash
ssh root@159.195.8.21
git clone https://github.com/Grupo-19-Dev/form_grupo19.git /opt/docker/stacks/g19-formulario
cd /opt/docker/stacks/g19-formulario
cp .env.example .env && chmod 600 .env
vi .env                     # SUPABASE_URL e WEBHOOK_URL reais
docker compose up -d --build
```

## Atualizar (depois de um merge na main)

```bash
ssh root@159.195.8.21
cd /opt/docker/stacks/g19-formulario
git pull --ff-only
docker compose up -d --build
docker compose ps           # g19-formulario "healthy"
```

Se a mudança for na Edge Function, publique também na VPS charlie (o arquivo é lido a
cada requisição, não precisa reiniciar nada):

```bash
scp supabase/functions/contato-enviar/index.ts \
  root@159.195.9.175:/opt/supabase-project/volumes/functions/contato-enviar/index.ts
```

## Verificar

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://formulario.grupo19.app/
curl -sS https://formulario.grupo19.app/env.js
echo | openssl s_client -servername formulario.grupo19.app -connect formulario.grupo19.app:443 2>/dev/null | openssl x509 -noout -issuer
```

Se o certificado não sair, rode `docker compose restart app` no stack.
**Nunca reinicie o container `traefik`**: ele atende todos os sites da VPS.
