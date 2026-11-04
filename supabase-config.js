// ============================================================
// Configuração do Supabase
// Painel do Supabase > Project Settings > API
// ============================================================

// "Project URL"
const SUPABASE_URL = 'https://bbeexsemmmbmtoznsvfb.supabase.co';

// Chave "anon" / "publishable" (pública, protegida pelas regras RLS).
// NUNCA coloque aqui a chave "service_role".
const SUPABASE_ANON_KEY = 'sb_publishable_jA7Tlodfj-9PWA9YbfqGSg__C7yqI1H';

// Nome da tabela onde as mensagens serão salvas
const SUPABASE_TABELA = 'contatos';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// URL do webhook que também recebe os dados do formulário
const WEBHOOK_URL = 'https://hooks.grupo19.app/webhook/recebe_formulario';