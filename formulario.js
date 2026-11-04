const form = document.getElementById('form-contato');
const btnEnviar = document.getElementById('btn-enviar');
const statusEl = document.getElementById('form-status');

const telefoneEl = document.getElementById('telefone');
const mensagemEl = document.getElementById('mensagem');

const REGEX_TELEFONE = /^\(\d{2}\) \d{4,5}-\d{4}$/;
const MIN_MENSAGEM = 10;

const imagemEl = document.getElementById('imagem');
const BUCKET_IMAGENS = 'imagem-form';
const MAX_IMAGEM_MB = 5;

// Envia a foto para o bucket e devolve a URL pública
async function enviarImagem(arquivo) {
    const ext = arquivo.name.split('.').pop().toLowerCase();
    const caminho = crypto.randomUUID() + '.' + ext; // nome único, evita conflito e caracteres estranhos

    const { error } = await supabaseClient.storage
        .from(BUCKET_IMAGENS)
        .upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });
    if (error) throw error;

    const { data } = supabaseClient.storage.from(BUCKET_IMAGENS).getPublicUrl(caminho);
    return data.publicUrl;
}



// Máscara: remove tudo que não é número e formata como (00) 00000-0000
function aplicarMascaraTelefone(valor) {
    const n = valor.replace(/\D/g, '').slice(0, 11);

    if (n.length > 10) return n.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, '($1) $2-$3');
    if (n.length > 6) return n.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
    if (n.length > 2) return n.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
    if (n.length > 0) return '(' + n;
    return '';
}

telefoneEl.addEventListener('input', () => {
    telefoneEl.value = aplicarMascaraTelefone(telefoneEl.value);
});


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

    // Telefone é opcional, mas se for preenchido precisa estar completo
    const telefone = form.telefone.value.trim();
    if (telefone && !REGEX_TELEFONE.test(telefone)) {
        mostrarStatus('erro', 'Telefone inválido. Use o formato (00) 00000-0000.');
        telefoneEl.focus();
        return;
    }

    // Mensagem com no mínimo 10 caracteres (sem contar espaços nas pontas)
    if (form.mensagem.value.trim().length < MIN_MENSAGEM) {
        mostrarStatus('erro', 'A mensagem deve ter no mínimo ' + MIN_MENSAGEM + ' caracteres.');
        mensagemEl.focus();
        return;
    }

        const arquivo = imagemEl.files[0] || null;
    if (arquivo) {
        if (!arquivo.type.startsWith('image/')) {
            mostrarStatus('erro', 'Envie apenas arquivos de imagem.');
            return;
        }
        if (arquivo.size > MAX_IMAGEM_MB * 1024 * 1024) {
            mostrarStatus('erro', 'A imagem deve ter no máximo ' + MAX_IMAGEM_MB + ' MB.');
            return;
        }
    }


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
        if (arquivo) dados.imagem = await enviarImagem(arquivo);
    } catch (erro) {
        console.error('Erro no upload da imagem:', erro);
        mostrarStatus('erro', 'Não foi possível enviar a imagem. Tente novamente.');
        btnEnviar.disabled = false;
        btnEnviar.textContent = 'Enviar Mensagem';
        return;
    }
    

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