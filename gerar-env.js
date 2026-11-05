// Gera o env.js que o navegador carrega.
// O site é HTML puro (sem build), então o navegador não lê o .env sozinho.
//
// - Na sua máquina: lê o arquivo .env
// - No GitHub Actions (deploy do Pages): lê as variáveis de ambiente,
//   que vêm dos Secrets do repositório
//
// Uso: node gerar-env.js
const fs = require('fs');
const path = require('path');

const CHAVES = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_TABELA', 'WEBHOOK_URL'];
const arquivoEnv = path.join(__dirname, '.env');

const env = {};

if (fs.existsSync(arquivoEnv)) {
    for (const linha of fs.readFileSync(arquivoEnv, 'utf8').split(/\r?\n/)) {
        const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
}

// Variáveis de ambiente completam o que não veio do .env
for (const k of CHAVES) {
    if (!env[k] && process.env[k]) env[k] = process.env[k];
}

const faltando = CHAVES.filter((k) => !env[k]);
if (faltando.length) {
    console.error('Faltam valores para: ' + faltando.join(', '));
    console.error('Na sua máquina: copie o .env.example para .env e preencha.');
    console.error('No GitHub: cadastre em Settings > Secrets and variables > Actions.');
    process.exit(1);
}

const config = Object.fromEntries(CHAVES.map((k) => [k, env[k]]));
const conteudo =
    '// Gerado por gerar-env.js. Não edite e não commite.\n' +
    'window.ENV = ' + JSON.stringify(config, null, 4) + ';\n';

fs.writeFileSync(path.join(__dirname, 'env.js'), conteudo);
console.log('env.js gerado.');
