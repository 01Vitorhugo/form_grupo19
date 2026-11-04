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

    try {
        // Sem .select() de propósito: a política RLS só permite INSERT para anônimos
        const { error } = await supabaseClient.from(SUPABASE_TABELA).insert(dados);

        if (error) throw error;

        mostrarStatus('sucesso', 'Mensagem enviada com sucesso!');
        form.reset();
    } catch (err) {
        console.error('Erro ao enviar:', err);
        mostrarStatus('erro', 'Não foi possível enviar. Tente novamente em instantes.');
    } finally {
        btnEnviar.disabled = false;
        btnEnviar.textContent = 'Enviar Mensagem';
    }
});