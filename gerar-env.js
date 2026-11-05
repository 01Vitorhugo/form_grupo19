// Lê o .env e gera o env.js que o navegador carrega.
// O site é HTML puro (sem build), então o navegador não lê o .env sozinho.
// Uso: node gerar-env.js
const fs = require('fs');
const path = require('path');

const CHAVES = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_TABELA', 'WEBHOOK_URL'];
const arquivoEnv = path.join(__dirname, '.env');

if (!fs.existsSync(arquivoEnv)) {
    console.error('Arquivo .env não encontrado. Copie o .env.example para .env e preencha.');
    process.exit(1);
}

const env = {};
for (const linha of fs.readFileSync(arquivoEnv, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const faltando = CHAVES.filter((k) => !env[k]);
if (faltando.length) {
    console.error('Faltam no .env: ' + faltando.join(', '));
    process.exit(1);
}

const config = Object.fromEntries(CHAVES.map((k) => [k, env[k]]));
const conteudo =
    '// Gerado por gerar-env.js a partir do .env. Não edite e não commite.\n' +
    'window.ENV = ' + JSON.stringify(config, null, 4) + ';\n';

fs.writeFileSync(path.join(__dirname, 'env.js'), conteudo);
console.log('env.js gerado.');
