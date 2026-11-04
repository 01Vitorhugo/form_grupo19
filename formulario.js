const form = document.getElementById('form-contato');
const btnEnviar = document.getElementById('btn-enviar');
const statusEl = document.getElementById('form-status');

function mostrarStatus(tipo, texto) {
    statusEl.className = 'form-status ' + tipo;
    statusEl.textContent = texto;
}

function configurado() {
    return !SUPABASE_URL.includes('SEU-PROJETO') && !SUPABASE_ANON_KEY.includes('SUA-CHAVE');
}

// Salva a mensagem na tabela do Supabase
async function salvarNoSupabase(dados) {
    // Sem .select() de propósito: a política RLS só permite INSERT para anônimos
    const { error } = await supabaseClient.from(SUPABASE_TABELA).insert(dados);
    if (error) throw error;
}

// Envia os mesmos dados para o webhook (com limite de 10 segundos)
async function enviarParaWebhook(dados) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
        const resposta = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...dados,
                enviado_em: new Date().toISOString(),
            }),
            signal: controller.signal,
        });

        if (!resposta.ok) {
             console.log(resposta);
            throw new Error('Webhook respondeu com status ' + resposta.status);
           
        }
    } finally {
        clearTimeout(timeout);
    }
}

form.addEventListener('submit', async (event) => {
    event.preventDefault();

    // Validação nativa do navegador (o form usa novalidate)
    if (!form.reportValidity()) return;

    if (!configurado()) {
        mostrarStatus('erro', 'Configure a URL e a chave em supabase-config.js.');
        return;
    }

    const dados = {
        nome: form.nome.value.trim(),
        email: form.email.value.trim(),
        telefone: form.telefone.value.trim() || null,
        assunto: form.assunto.value,
        mensagem: form.mensagem.value.trim(),
    };

    btnEnviar.disabled = true;
    btnEnviar.textContent = 'Enviando...';
    statusEl.className = 'form-status';

    // Os dois envios acontecem ao mesmo tempo; um não bloqueia o outro
    const [resSupabase, resWebhook] = await Promise.allSettled([
        salvarNoSupabase(dados),
        enviarParaWebhook(dados),
    ]);

    if (resSupabase.status === 'rejected') console.error('Erro no Supabase:', resSupabase.reason);
    if (resWebhook.status === 'rejected') console.error('Erro no webhook:', resWebhook.reason);

    const ambosFalharam = resSupabase.status === 'rejected' && resWebhook.status === 'rejected';

    if (ambosFalharam) {
        mostrarStatus('erro', 'Não foi possível enviar. Tente novamente em instantes.');
    } else {
        mostrarStatus('sucesso', 'Mensagem enviada com sucesso!');
        form.reset();
    }

    btnEnviar.disabled = false;
    btnEnviar.textContent = 'Enviar Mensagem';
});