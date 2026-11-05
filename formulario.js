const form = document.getElementById('form-contato');
const btnEnviar = document.getElementById('btn-enviar');
const statusEl = document.getElementById('form-status');

const telefoneEl = document.getElementById('telefone');
const mensagemEl = document.getElementById('mensagem');

const REGEX_TELEFONE = /^\(\d{2}\) \d{4,5}-\d{4}$/;
const MIN_MENSAGEM = 10;

const imagemEl = document.getElementById('imagem');
const TIPOS_IMAGEM = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGEM_MB = 5;
const imagemNomeEl = document.getElementById('imagem-nome');
const TEXTO_IMAGEM_VAZIA = 'Escolher imagem';

// Tema claro/escuro: mesmo cookie dos apps G19 (g19_theme), vale por 1 ano
document.getElementById('theme-switch').addEventListener('click', () => {
    const claro = document.documentElement.dataset.theme !== 'light';
    if (claro) document.documentElement.dataset.theme = 'light';
    else delete document.documentElement.dataset.theme;
    document.cookie = 'g19_theme=' + (claro ? 'light' : 'dark') + '; path=/; max-age=31536000; SameSite=Lax';
});

// Mostra o nome da imagem escolhida no campo
function atualizarNomeImagem() {
    const arquivo = imagemEl.files[0];
    imagemNomeEl.textContent = arquivo ? arquivo.name : TEXTO_IMAGEM_VAZIA;
}
imagemEl.addEventListener('change', atualizarNomeImagem);



// Remove tudo que não é número: "(11) 98765-4321" -> "11987654321"
function somenteDigitos(valor) {
    return valor.replace(/\D/g, '');
}

// Máscara: remove tudo que não é número e formata como (00) 00000-0000
function aplicarMascaraTelefone(valor) {
    const n = somenteDigitos(valor).slice(0, 11);

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
    return FUNCAO_ENVIO_URL !== '' && !SUPABASE_URL.includes('SEU-PROJETO');
}

// Envia o formulário (com a foto, se houver) para a função do Supabase do G19,
// que valida e grava. Devolve { id, imagem_url? } — imagem_url é um link temporário.
async function salvarNoSupabase(dados, arquivo) {
    const corpo = new FormData();
    for (const [campo, valor] of Object.entries(dados)) {
        if (valor) corpo.append(campo, valor);
    }
    corpo.append('website', form.website.value); // campo isca contra robôs
    if (arquivo) corpo.append('imagem', arquivo);

    const resposta = await fetch(FUNCAO_ENVIO_URL, { method: 'POST', body: corpo });
    let retorno = {};
    try { retorno = await resposta.json(); } catch { /* resposta sem JSON */ }

    if (!resposta.ok || !retorno.ok) {
        const erro = new Error(retorno.erro || 'Função respondeu com status ' + resposta.status);
        erro.status = resposta.status;
        throw erro;
    }
    return retorno;
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
        if (!TIPOS_IMAGEM.includes(arquivo.type)) {
            mostrarStatus('erro', 'Envie uma imagem JPG, PNG ou WEBP.');
            return;
        }
        if (arquivo.size > MAX_IMAGEM_MB * 1024 * 1024) {
            mostrarStatus('erro', 'A imagem deve ter no máximo ' + MAX_IMAGEM_MB + ' MB.');
            return;
        }
    }


    if (!configurado()) {
        mostrarStatus('erro', 'Configure o .env e rode "node gerar-env.js".');
        return;
    }

    const dados = {
        nome: form.nome.value.trim(),
        email: form.email.value.trim(),
        // A máscara é só visual: para o banco e o webhook vão apenas os dígitos
        telefone: somenteDigitos(form.telefone.value) || null,
        assunto: form.assunto.value,
        mensagem: form.mensagem.value.trim(),
    };

    btnEnviar.disabled = true;
    btnEnviar.textContent = 'Enviando...';
    statusEl.className = 'form-status';

    // 1. Banco (com a foto). O resultado traz o id e o link temporário da foto.
    let salvo = null;
    let erroBanco = null;
    try {
        salvo = await salvarNoSupabase(dados, arquivo);
    } catch (erro) {
        erroBanco = erro;
        console.error('Erro no Supabase:', erro);
    }

    // Erros de validação ou excesso de envios: mostra o motivo e não manda ao webhook
    if (erroBanco && (erroBanco.status === 400 || erroBanco.status === 429)) {
        mostrarStatus('erro', erroBanco.message);
        btnEnviar.disabled = false;
        btnEnviar.textContent = 'Enviar mensagem';
        return;
    }

    // 2. Webhook (n8n): recebe os mesmos dados, mais o id e o link da foto quando o banco gravou
    let erroWebhook = null;
    try {
        await enviarParaWebhook({
            ...dados,
            id: salvo?.id ?? null,
            imagem: salvo?.imagem_url ?? null,
        });
    } catch (erro) {
        erroWebhook = erro;
        console.error('Erro no webhook:', erro);
    }

    const ambosFalharam = erroBanco && erroWebhook;

    if (ambosFalharam) {
        mostrarStatus('erro', 'Não foi possível enviar. Tente novamente em instantes.');
    } else {
        mostrarStatus('sucesso', 'Mensagem enviada com sucesso!');
        form.reset();
        atualizarNomeImagem();
    }

    btnEnviar.disabled = false;
    btnEnviar.textContent = 'Enviar mensagem';
});