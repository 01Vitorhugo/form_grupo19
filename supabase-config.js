// ============================================================
// Endereços usados pelo formulário
// Os valores vêm do .env (via env.js, gerado por "node gerar-env.js").
//
// O site não guarda nenhuma chave do banco: ele envia o formulário para a
// Edge Function "contato-enviar" do Supabase do Grupo19, que valida e grava
// no schema "contato" (foto no bucket privado "contato-imagens").
// ============================================================

const ENV = window.ENV || {};

const SUPABASE_URL = (ENV.SUPABASE_URL || '').replace(/\/+$/, '');
const WEBHOOK_URL = ENV.WEBHOOK_URL || '';

const FUNCAO_ENVIO_URL = SUPABASE_URL ? SUPABASE_URL + '/functions/v1/contato-enviar' : '';
