-- 0002_limite_envio.sql — limite de envios por visitante (anti-spam)
-- Criado em 05/11/2026. Usado pela Edge Function contato-enviar.
--
-- Guarda só um HASH do IP (nunca o IP) e a hora do envio. A função conta os envios
-- recentes do mesmo hash e apaga os registros com mais de 1 dia.
-- Permissões vêm dos default privileges da 0001 (app_contato grava; leitura_ampla lê).

begin;

create table contato.envio (
  id          bigint generated always as identity primary key,
  ip_hash     text not null,
  created_at  timestamptz not null default now()
);
comment on table contato.envio is 'Envios recentes por visitante (hash do IP), para limitar spam. Limpo pela função contato-enviar';

create index envio_ip_hash_created_at_idx on contato.envio (ip_hash, created_at desc);

alter table contato.envio enable row level security;

create policy app_contato_tudo on contato.envio for all to app_contato
  using (true) with check (true);

commit;
