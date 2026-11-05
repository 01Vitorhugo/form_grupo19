// contato-enviar: recebe o formulário de contato (site estático no GitHub Pages) e grava no
// schema contato do Supabase do Grupo19, com a foto no bucket privado contato-imagens.
//
// Publicada em /opt/supabase-project/volumes/functions/contato-enviar/ na VPS charlie
// (o roteador "main" carrega a função a cada requisição; publicar = copiar o arquivo).
//
// Chamada: POST https://supabase.grupo19.app/functions/v1/contato-enviar
// Corpo: multipart/form-data com nome, email, telefone?, assunto?, mensagem, imagem? (arquivo)
//        e "website" (campo isca, fica vazio para pessoas).
// Resposta: { ok: true, id, imagem_url? }  — imagem_url é um link temporário (7 dias).
//
// Segurança:
//  - O navegador não recebe nenhuma chave. A função assina na hora um token do papel
//    app_contato válido por 60 s (o JWT secret só existe dentro desta VPS) e fala com a
//    API e o Storage com ele. app_contato só alcança o schema contato e o bucket contato-imagens.
//  - Limite: MAX_ENVIOS por visitante (hash do IP) a cada JANELA_MIN minutos.
//  - Só aceita chamadas dos sites em ORIGENS.
import * as jose from "jsr:@panva/jose@6";

const API = Deno.env.get("SUPABASE_URL")!; // http://api-gw:8000 (rede interna)
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SEGREDO = new TextEncoder().encode(Deno.env.get("JWT_SECRET")!);

const ORIGENS = [/^https:\/\/grupo-19-dev\.github\.io$/, /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/];
const BUCKET = "contato-imagens";
const MAX_IMAGEM = 5 * 1024 * 1024;
const TIPOS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_ENVIOS = 5;
const JANELA_MIN = 10;
const LINK_DIAS = 7;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function resposta(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
}
const erro = (msg: string, status = 400) => resposta({ ok: false, erro: msg }, status);

async function tokenApp(): Promise<string> {
  return await new jose.SignJWT({ role: "app_contato", sistema: "contato" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer("supabase-grupo19")
    .setIssuedAt()
    .setExpirationTime("60s")
    .sign(SEGREDO);
}

async function sha256(texto: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Confere os primeiros bytes do arquivo (não confia só no tipo que o navegador declara). */
function tipoReal(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

function texto(f: FormData, campo: string): string {
  const v = f.get(campo);
  return typeof v === "string" ? v.trim() : "";
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return erro("Método não permitido.", 405);
  const origem = req.headers.get("origin") ?? "";
  if (!ORIGENS.some((r) => r.test(origem))) return erro("Origem não permitida.", 403);

  let f: FormData;
  try { f = await req.formData(); } catch { return erro("Envie o formulário como multipart/form-data."); }

  // Campo isca: robôs preenchem, pessoas não veem. Finge sucesso para não ensinar o robô.
  if (texto(f, "website")) return resposta({ ok: true });

  const dados = {
    nome: texto(f, "nome"),
    email: texto(f, "email"),
    telefone: texto(f, "telefone").replace(/\D/g, "") || null,
    assunto: texto(f, "assunto") || null,
    mensagem: texto(f, "mensagem"),
  };
  if (!dados.nome || dados.nome.length > 200) return erro("Informe o nome (até 200 caracteres).");
  if (!EMAIL.test(dados.email) || dados.email.length > 320) return erro("Email inválido.");
  if (dados.telefone && dados.telefone.length > 30) return erro("Telefone inválido.");
  if (dados.assunto && dados.assunto.length > 200) return erro("Assunto muito longo.");
  if (dados.mensagem.length < 10 || dados.mensagem.length > 5000) return erro("A mensagem deve ter de 10 a 5000 caracteres.");

  const arquivo = f.get("imagem");
  let imagem: { bytes: Uint8Array; tipo: string } | null = null;
  if (arquivo instanceof File && arquivo.size > 0) {
    if (arquivo.size > MAX_IMAGEM) return erro("A imagem deve ter no máximo 5 MB.");
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    const tipo = tipoReal(bytes);
    if (!tipo) return erro("Envie uma imagem JPG, PNG ou WEBP.");
    imagem = { bytes, tipo };
  }

  try {
    const token = await tokenApp();
    const h = { apikey: ANON, Authorization: `Bearer ${token}` };
    const rest = (caminho: string, init: RequestInit = {}, schema = "contato") =>
      fetch(`${API}/rest/v1/${caminho}`, {
        ...init,
        headers: { ...h, "Accept-Profile": schema, "Content-Profile": schema, "Content-Type": "application/json", ...(init.headers ?? {}) },
      });

    // Limite por visitante (só o hash do IP é guardado)
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "";
    if (ip) {
      const ipHash = await sha256(`contato:${ip}:${Deno.env.get("JWT_SECRET")}`);
      const desde = new Date(Date.now() - JANELA_MIN * 60_000).toISOString();
      const r = await rest(`envio?select=id&ip_hash=eq.${ipHash}&created_at=gte.${desde}`);
      const recentes = r.ok ? (await r.json()).length : 0;
      if (recentes >= MAX_ENVIOS) return erro("Muitos envios seguidos. Tente de novo em alguns minutos.", 429);
      await rest("envio", { method: "POST", body: JSON.stringify({ ip_hash: ipHash }) });
      // faxina: registros com mais de 1 dia
      await rest(`envio?created_at=lt.${new Date(Date.now() - 86_400_000).toISOString()}`, { method: "DELETE" });
    } else {
      console.warn("contato-enviar: requisição sem IP; limite não aplicado");
    }

    // 1. Foto no bucket privado
    let caminho: string | null = null;
    if (imagem) {
      const agora = new Date();
      caminho = `${agora.getUTCFullYear()}/${String(agora.getUTCMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}.${TIPOS[imagem.tipo]}`;
      const up = await fetch(`${API}/storage/v1/object/${BUCKET}/${caminho}`, {
        method: "POST",
        headers: { ...h, "Content-Type": imagem.tipo, "x-upsert": "false" },
        body: imagem.bytes,
      });
      if (!up.ok) {
        console.error("contato-enviar: upload", up.status, await up.text());
        return erro("Não foi possível salvar a imagem.", 502);
      }
    }

    // 2. Mensagem
    const ins = await rest("mensagem?select=id", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ ...dados, imagem: caminho }),
    });
    if (!ins.ok) {
      console.error("contato-enviar: insert", ins.status, await ins.text());
      if (caminho) await fetch(`${API}/storage/v1/object/${BUCKET}/${caminho}`, { method: "DELETE", headers: h });
      return erro("Não foi possível salvar a mensagem.", 502);
    }
    const [{ id }] = await ins.json();

    // 3. Link temporário da foto (para o webhook do n8n)
    let imagem_url: string | undefined;
    if (caminho) {
      const s = await fetch(`${API}/storage/v1/object/sign/${BUCKET}/${caminho}`, {
        method: "POST",
        headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify({ expiresIn: LINK_DIAS * 86_400 }),
      });
      if (s.ok) imagem_url = `${Deno.env.get("SUPABASE_PUBLIC_URL")}/storage/v1${(await s.json()).signedURL}`;
    }

    return resposta({ ok: true, id, imagem_url });
  } catch (e) {
    console.error("contato-enviar", e);
    return erro("Erro interno.", 500);
  }
});
