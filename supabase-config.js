// ============================================================
// Configuração do Supabase e do webhook
// Os valores vêm do .env (via env.js, gerado por "node gerar-env.js").
// Nunca coloque chaves diretamente neste arquivo.
// ============================================================

const ENV = window.ENV || {};

const SUPABASE_URL = ENV.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = ENV.SUPABASE_ANON_KEY || '';
const SUPABASE_TABELA = ENV.SUPABASE_TABELA || 'contatos';
const WEBHOOK_URL = ENV.WEBHOOK_URL || '';

const supabaseClient = SUPABASE_URL && SUPABASE_ANON_KEY
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;
