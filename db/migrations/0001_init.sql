-- 0001_init.sql — sistema "contato" (formulário de contato)
-- Criado em 05/11/2026. Aplicado à mão na VPS charlie-autoflow:
--   ssh root@159.195.9.175 "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1" < 0001_init.sql
--
-- Modelo de acesso (padrão G19, login próprio):
--   * O visitante preenche o formulário; quem grava é o SERVIDOR do app, com o token
--     SUPABASE_APP_KEY (papel app_contato). Schema fechado para anon e authenticated.
--   * app_contato é criado SEM bypassrls (diferente dos outros app_*): ele também usa o
--     Storage, e com bypassrls enxergaria os arquivos de todos os buckets. Aqui o acesso
--     vem de policies explícitas, só no schema contato e no bucket contato-imagens.
--   * leitura_ampla (Métricas, agente de IA) lê o schema.
--   * Bucket contato-imagens PRIVADO; para exibir, o app gera link assinado (signed URL).

begin;

-- 1. Schema ------------------------------------------------------------------
create schema contato;
comment on schema contato is 'Formulário de contato (mensagens + imagens no bucket contato-imagens)';

-- Funções novas não ficam executáveis por todo mundo
alter default privileges in schema contato revoke execute on functions from public;

-- 2. Papel do servidor do app ------------------------------------------------
create role app_contato nologin;   -- sem bypassrls de propósito (ver cabeçalho)
comment on role app_contato is 'Servidor do Contato: só o schema contato e o bucket contato-imagens';
grant app_contato to authenticator; -- PostgREST e Storage podem assumir o papel pelo token

grant usage on schema contato to app_contato;
alter default privileges in schema contato
  grant select, insert, update, delete on tables to app_contato;
alter default privileges in schema contato grant usage, select on sequences to app_contato;
alter default privileges in schema contato grant execute on functions to app_contato;

-- Dados compartilhados: só leitura (padrão dos app_*)
grant usage on schema core to app_contato;
grant select on all tables in schema core to app_contato;

-- Administração
grant usage on schema contato to service_role;
alter default privileges in schema contato grant all on tables to service_role;

-- Leitura ampla
grant usage on schema contato to leitura_ampla;
alter default privileges in schema contato grant select on tables to leitura_ampla;

-- 3. Tabela ------------------------------------------------------------------
create table contato.mensagem (
  id          text primary key default gen_random_uuid()::text,
  created_at  timestamptz not null default now(),
  nome        text not null check (length(trim(nome)) between 1 and 200),
  email       text not null check (length(email) <= 320 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  telefone    text check (length(telefone) <= 30),
  assunto     text check (length(assunto) <= 200),
  mensagem    text not null check (length(trim(mensagem)) between 1 and 5000),
  imagem      text          -- caminho do arquivo no bucket contato-imagens (ex.: '2026/11/<id>.jpg'), ou null
);
comment on table contato.mensagem is 'Mensagens enviadas pelo formulário de contato';
comment on column contato.mensagem.imagem is 'Caminho do arquivo no bucket privado contato-imagens; exibir via signed URL';

create index mensagem_created_at_idx on contato.mensagem (created_at desc);

alter table contato.mensagem enable row level security;

-- Só o servidor do app. anon/authenticated não têm grant nem policy: ficam de fora.
create policy app_contato_tudo on contato.mensagem for all to app_contato
  using (true) with check (true);

-- 4. Bucket privado para as imagens -----------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contato-imagens', 'contato-imagens', false, 5242880,   -- 5 MB
        array['image/jpeg', 'image/png', 'image/webp']);

-- app_contato só enxerga este bucket e os arquivos dele
grant usage on schema storage to app_contato;
grant select on storage.buckets to app_contato;
grant select, insert, update, delete on storage.objects to app_contato;

create policy contato_bucket_leitura on storage.buckets for select to app_contato
  using (id = 'contato-imagens');

create policy contato_imagens_app on storage.objects for all to app_contato
  using (bucket_id = 'contato-imagens')
  with check (bucket_id = 'contato-imagens');

commit;
