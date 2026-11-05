# Formulário de contato do Grupo19 — site estático servido por nginx.
#
# Não há build nem servidor de aplicação: o navegador envia o formulário para a Edge
# Function "contato-enviar" do Supabase do Grupo19 e para o webhook do n8n.
# O env.js (SUPABASE_URL e WEBHOOK_URL, que são públicos) é gerado quando o container
# sobe, a partir do .env do deploy. Assim trocar um endereço não exige nova imagem.

FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/gerar-env.sh /docker-entrypoint.d/40-gerar-env.sh
COPY formulario.html formulario.css formulario.js supabase-config.js /usr/share/nginx/html/
COPY formulario.html /usr/share/nginx/html/index.html

USER root
# Remove CR caso o arquivo tenha vindo de um checkout no Windows
RUN sed -i 's/\r$//' /docker-entrypoint.d/40-gerar-env.sh /etc/nginx/conf.d/default.conf \
    && chmod 755 /docker-entrypoint.d/40-gerar-env.sh
USER 101

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
