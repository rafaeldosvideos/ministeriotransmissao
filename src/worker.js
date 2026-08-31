/**
 * Sistema Ministerio de Transmissao — Worker (API + entrega do SPA).
 *
 * Leitura e publica. Escrita exige um PIN unico compartilhado, guardado como
 * secret do Worker (ADMIN_PIN). O PIN nunca chega ao cliente: o navegador troca
 * o PIN por um cookie de sessao assinado (HMAC-SHA256) com validade curta.
 */

const COOKIE = "mt_sessao";
const SESSAO_MS = 12 * 60 * 60 * 1000; // 12 horas
const MAX_FALHAS = 8;
const BLOQUEIO_MS = 15 * 60 * 1000;
const HISTORICO_PADRAO = 12;

const LIMITES = {
  titulo: 120,
  local: 120,
  observacoes: 2000,
  nome: 80,
  contato: 120,
  resumo: 300,
  corpo: 20000,
  equipeNome: 60,
};

/* ------------------------------------------------------------------ */
/* Utilidades HTTP                                                     */
/* ------------------------------------------------------------------ */

function json(dados, status = 200, cabecalhos = {}) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...cabecalhos,
    },
  });
}

const erro = (mensagem, status = 400) => json({ erro: mensagem }, status);

class ErroApi extends Error {
  constructor(mensagem, status = 400) {
    super(mensagem);
    this.status = status;
  }
}

function lerCookie(request, nome) {
  const bruto = request.headers.get("cookie") || "";
  for (const parte of bruto.split(";")) {
    const [chave, ...resto] = parte.trim().split("=");
    if (chave === nome) return decodeURIComponent(resto.join("="));
  }
  return null;
}

function cookieSessao(token) {
  const maxAge = token ? Math.floor(SESSAO_MS / 1000) : 0;
  return `${COOKIE}=${token || ""}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

/* ------------------------------------------------------------------ */
/* Autenticacao                                                        */
/* ------------------------------------------------------------------ */

const enc = new TextEncoder();

function segredoDaSessao(env) {
  // SESSION_SECRET e opcional: sem ele, o proprio PIN assina a sessao.
  return env.SESSION_SECRET || env.ADMIN_PIN || "";
}

function base64url(buffer) {
  let bin = "";
  for (const b of new Uint8Array(buffer)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function assinar(segredo, texto) {
  const chave = await crypto.subtle.importKey(
    "raw",
    enc.encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64url(await crypto.subtle.sign("HMAC", chave, enc.encode(texto)));
}

/** Comparacao em tempo constante para strings de mesmo tamanho. */
function comparaConstante(a, b) {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

/** Compara segredos de tamanhos diferentes sem vazar o comprimento. */
async function comparaSegredos(a, b) {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  return comparaConstante(base64url(ha), base64url(hb));
}

async function criarToken(env) {
  const expira = String(Date.now() + SESSAO_MS);
  return `${expira}.${await assinar(segredoDaSessao(env), expira)}`;
}

async function ehAdmin(request, env) {
  const segredo = segredoDaSessao(env);
  if (!segredo) return false;
  const token = lerCookie(request, COOKIE);
  if (!token) return false;
  const corte = token.lastIndexOf(".");
  if (corte < 1) return false;
  const expira = token.slice(0, corte);
  const assinatura = token.slice(corte + 1);
  if (!comparaConstante(assinatura, await assinar(segredo, expira))) return false;
  return Number(expira) > Date.now();
}

async function exigirAdmin(request, env) {
  if (!(await ehAdmin(request, env))) {
    throw new ErroApi("Sessao de edicao expirada ou ausente. Entre com o PIN novamente.", 401);
  }
}

/** Bloqueia POST/PUT/DELETE vindos de outra origem (CSRF). */
function conferirOrigem(request, url) {
  const origem = request.headers.get("origin");
  if (origem && origem !== url.origin) {
    throw new ErroApi("Origem nao permitida.", 403);
  }
}

/* ------------------------------------------------------------------ */
/* Freio de forca bruta no PIN                                         */
/* ------------------------------------------------------------------ */

const ipDe = (request) => request.headers.get("cf-connecting-ip") || "desconhecido";

async function estadoBloqueio(env, ip) {
  const linha = await env.DB.prepare("SELECT falhas, bloqueado_ate FROM tentativas_login WHERE ip = ?")
    .bind(ip)
    .first();
  if (!linha) return { falhas: 0, restante: 0 };
  const restante = Math.max(0, Number(linha.bloqueado_ate) - Date.now());
  return { falhas: Number(linha.falhas), restante };
}

async function registrarFalha(env, ip) {
  const { falhas } = await estadoBloqueio(env, ip);
  const novas = falhas + 1;
  const bloqueadoAte = novas >= MAX_FALHAS ? Date.now() + BLOQUEIO_MS : 0;
  await env.DB.prepare(
    `INSERT INTO tentativas_login (ip, falhas, bloqueado_ate) VALUES (?1, ?2, ?3)
     ON CONFLICT(ip) DO UPDATE SET falhas = ?2, bloqueado_ate = ?3`,
  )
    .bind(ip, novas >= MAX_FALHAS ? 0 : novas, bloqueadoAte)
    .run();
  return MAX_FALHAS - novas;
}

const limparFalhas = (env, ip) =>
  env.DB.prepare("DELETE FROM tentativas_login WHERE ip = ?").bind(ip).run();

/* ------------------------------------------------------------------ */
/* Validacao de entrada                                                */
/* ------------------------------------------------------------------ */

function texto(valor, limite, campo, obrigatorio = false) {
  const v = typeof valor === "string" ? valor.trim() : "";
  if (obrigatorio && !v) throw new ErroApi(`Campo obrigatorio: ${campo}.`);
  if (v.length > limite) throw new ErroApi(`Campo ${campo} passou de ${limite} caracteres.`);
  return v;
}

function dataValida(valor) {
  const v = texto(valor, 10, "data", true);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new ErroApi("Data invalida (use AAAA-MM-DD).");
  const [a, m, d] = v.split("-").map(Number);
  const teste = new Date(Date.UTC(a, m - 1, d));
  if (teste.getUTCFullYear() !== a || teste.getUTCMonth() !== m - 1 || teste.getUTCDate() !== d) {
    throw new ErroApi("Data inexistente no calendario.");
  }
  return v;
}

function horaValida(valor) {
  const v = texto(valor, 5, "hora");
  if (v && !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw new ErroApi("Hora invalida (use HH:MM).");
  return v;
}

function inteiro(valor, padrao = 0) {
  const n = Number.parseInt(valor, 10);
  return Number.isFinite(n) ? n : padrao;
}

function idNumerico(valor) {
  const n = Number.parseInt(valor, 10);
  if (!Number.isFinite(n) || n <= 0) throw new ErroApi("Identificador invalido.");
  return n;
}

function paginaValida(valor) {
  const v = texto(valor, 80, "pagina", true);
  if (!/^(geral|instrucoes|equipe:[a-z0-9-]{1,60})$/.test(v)) throw new ErroApi("Pagina invalida.");
  return v;
}

function gerarId(nome) {
  const base = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return base || `equipe-${Date.now().toString(36)}`;
}

async function corpoJson(request) {
  try {
    const dados = await request.json();
    if (!dados || typeof dados !== "object") throw new Error();
    return dados;
  } catch {
    throw new ErroApi("Corpo da requisicao invalido.");
  }
}

/* ------------------------------------------------------------------ */
/* Datas                                                               */
/* ------------------------------------------------------------------ */

function hojeNoFuso(env) {
  const fuso = env.FUSO || "America/Sao_Paulo";
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: fuso }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/* ------------------------------------------------------------------ */
/* Leitura do estado completo                                          */
/* ------------------------------------------------------------------ */

async function lerEstado(request, env, url) {
  const admin = await ehAdmin(request, env);
  const hoje = hojeNoFuso(env);
  const historicoCompleto = url.searchParams.get("historico") === "1";

  const consultaTransmissoes = historicoCompleto
    ? env.DB.prepare("SELECT * FROM transmissoes ORDER BY data ASC, hora ASC")
    : env.DB.prepare(
        `SELECT * FROM transmissoes WHERE data >= ?1
         UNION ALL
         SELECT * FROM (SELECT * FROM transmissoes WHERE data < ?1 ORDER BY data DESC, hora DESC LIMIT ?2)
         ORDER BY data ASC, hora ASC`,
      ).bind(hoje, HISTORICO_PADRAO);

  const [equipes, transmissoes, escalas, membros, blocos] = await env.DB.batch([
    env.DB.prepare("SELECT id, nome, resumo, ordem FROM equipes ORDER BY ordem ASC, nome ASC"),
    consultaTransmissoes,
    env.DB.prepare("SELECT transmissao_id, equipe_id, nome FROM escalas ORDER BY ordem ASC, id ASC"),
    env.DB.prepare(
      "SELECT id, equipe_id, nome, contato, observacao FROM membros ORDER BY ordem ASC, nome ASC",
    ),
    env.DB.prepare("SELECT id, pagina, titulo, corpo, ordem FROM blocos ORDER BY pagina ASC, ordem ASC, id ASC"),
  ]);

  const porTransmissao = new Map();
  for (const e of escalas.results) {
    if (!porTransmissao.has(e.transmissao_id)) porTransmissao.set(e.transmissao_id, {});
    const mapa = porTransmissao.get(e.transmissao_id);
    (mapa[e.equipe_id] ||= []).push(e.nome);
  }

  const membrosPorEquipe = {};
  for (const m of membros.results) (membrosPorEquipe[m.equipe_id] ||= []).push(m);

  const blocosPorPagina = {};
  for (const b of blocos.results) (blocosPorPagina[b.pagina] ||= []).push(b);

  return json({
    admin,
    configurado: Boolean(env.ADMIN_PIN),
    hoje,
    historicoCompleto,
    equipes: equipes.results,
    transmissoes: transmissoes.results.map((t) => ({ ...t, escala: porTransmissao.get(t.id) || {} })),
    membros: membrosPorEquipe,
    blocos: blocosPorPagina,
  });
}

/* ------------------------------------------------------------------ */
/* Transmissoes                                                        */
/* ------------------------------------------------------------------ */

function camposTransmissao(dados) {
  return {
    data: dataValida(dados.data),
    hora: horaValida(dados.hora),
    titulo: texto(dados.titulo, LIMITES.titulo, "titulo", true),
    local: texto(dados.local, LIMITES.local, "local"),
    observacoes: texto(dados.observacoes, LIMITES.observacoes, "observacoes"),
  };
}

/** Aceita { "camera-central": ["Ana", "Joao"] } e devolve linhas prontas. */
function linhasDaEscala(escala, transmissaoId) {
  if (!escala || typeof escala !== "object") return [];
  const linhas = [];
  for (const [equipeId, nomes] of Object.entries(escala)) {
    if (!/^[a-z0-9-]{1,60}$/.test(equipeId) || !Array.isArray(nomes)) continue;
    nomes
      .map((n) => texto(n, LIMITES.nome, "nome do escalado"))
      .filter(Boolean)
      .slice(0, 20)
      .forEach((nome, i) => linhas.push({ transmissaoId, equipeId, nome, ordem: i }));
  }
  return linhas;
}

async function criarTransmissao(request, env) {
  const dados = await corpoJson(request);
  const campos = camposTransmissao(dados);
  const criada = await env.DB.prepare(
    `INSERT INTO transmissoes (data, hora, titulo, local, observacoes)
     VALUES (?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(campos.data, campos.hora, campos.titulo, campos.local, campos.observacoes)
    .first();

  const linhas = linhasDaEscala(dados.escala, criada.id);
  if (linhas.length) {
    await env.DB.batch(
      linhas.map((l) =>
        env.DB.prepare("INSERT INTO escalas (transmissao_id, equipe_id, nome, ordem) VALUES (?, ?, ?, ?)")
          .bind(l.transmissaoId, l.equipeId, l.nome, l.ordem),
      ),
    );
  }
  return json({ id: criada.id }, 201);
}

async function atualizarTransmissao(request, env, id) {
  const dados = await corpoJson(request);
  const campos = camposTransmissao(dados);
  const linhas = linhasDaEscala(dados.escala, id);

  const comandos = [
    env.DB.prepare(
      `UPDATE transmissoes SET data = ?, hora = ?, titulo = ?, local = ?, observacoes = ?,
       atualizado_em = datetime('now') WHERE id = ?`,
    ).bind(campos.data, campos.hora, campos.titulo, campos.local, campos.observacoes, id),
    env.DB.prepare("DELETE FROM escalas WHERE transmissao_id = ?").bind(id),
    ...linhas.map((l) =>
      env.DB.prepare("INSERT INTO escalas (transmissao_id, equipe_id, nome, ordem) VALUES (?, ?, ?, ?)")
        .bind(l.transmissaoId, l.equipeId, l.nome, l.ordem),
    ),
  ];
  const [atualizacao] = await env.DB.batch(comandos);
  if (!atualizacao.meta.changes) throw new ErroApi("Transmissao nao encontrada.", 404);
  return json({ ok: true });
}

/* ------------------------------------------------------------------ */
/* Roteador da API                                                     */
/* ------------------------------------------------------------------ */

async function roteadorApi(request, env, url) {
  const metodo = request.method;
  const rota = url.pathname.replace(/\/+$/, "");
  const partes = rota.split("/").filter(Boolean).slice(1); // remove "api"
  const escrita = metodo !== "GET" && metodo !== "HEAD";

  if (escrita) conferirOrigem(request, url);

  const [recurso, primeiro, segundo] = partes;

  /* ---- sessao ---- */
  if (recurso === "sessao" && !primeiro) {
    if (metodo === "GET") {
      return json({ admin: await ehAdmin(request, env), configurado: Boolean(env.ADMIN_PIN) });
    }

    if (metodo === "DELETE") {
      return json({ admin: false }, 200, { "set-cookie": cookieSessao(null) });
    }

    if (metodo === "POST") {
      if (!env.ADMIN_PIN) {
        return erro(
          "O PIN de edicao ainda nao foi configurado neste servidor. Rode: npx wrangler secret put ADMIN_PIN",
          503,
        );
      }
      const ip = ipDe(request);
      const { restante } = await estadoBloqueio(env, ip);
      if (restante > 0) {
        return erro(
          `Muitas tentativas erradas. Tente de novo em ${Math.ceil(restante / 60000)} minuto(s).`,
          429,
        );
      }
      const { pin } = await corpoJson(request);
      if (typeof pin !== "string" || !pin) return erro("Informe o PIN.");

      if (await comparaSegredos(pin, env.ADMIN_PIN)) {
        await limparFalhas(env, ip);
        return json({ admin: true }, 200, { "set-cookie": cookieSessao(await criarToken(env)) });
      }
      const sobrando = await registrarFalha(env, ip);
      return erro(
        sobrando > 0 ? `PIN incorreto. Restam ${sobrando} tentativa(s).` : "PIN incorreto. Acesso bloqueado por 15 minutos.",
        401,
      );
    }
  }

  /* ---- estado publico ---- */
  if (recurso === "estado" && !primeiro && metodo === "GET") {
    return lerEstado(request, env, url);
  }

  /* Daqui para baixo, tudo exige sessao de edicao. */
  if (escrita) await exigirAdmin(request, env);

  /* ---- transmissoes ---- */
  if (recurso === "transmissoes") {
    if (!primeiro && metodo === "POST") return criarTransmissao(request, env);
    if (primeiro && !segundo) {
      const id = idNumerico(primeiro);
      if (metodo === "PUT") return atualizarTransmissao(request, env, id);
      if (metodo === "DELETE") {
        await env.DB.batch([
          env.DB.prepare("DELETE FROM escalas WHERE transmissao_id = ?").bind(id),
          env.DB.prepare("DELETE FROM transmissoes WHERE id = ?").bind(id),
        ]);
        return json({ ok: true });
      }
    }
  }

  /* ---- equipes ---- */
  if (recurso === "equipes") {
    if (!primeiro && metodo === "POST") {
      const dados = await corpoJson(request);
      const nome = texto(dados.nome, LIMITES.equipeNome, "nome", true);
      const resumo = texto(dados.resumo, LIMITES.resumo, "resumo");
      let id = gerarId(nome);
      const existe = await env.DB.prepare("SELECT id FROM equipes WHERE id = ?").bind(id).first();
      if (existe) id = `${id}-${Date.now().toString(36).slice(-4)}`;
      const proxima = await env.DB.prepare("SELECT IFNULL(MAX(ordem), 0) + 1 AS n FROM equipes").first();
      await env.DB.prepare("INSERT INTO equipes (id, nome, resumo, ordem) VALUES (?, ?, ?, ?)")
        .bind(id, nome, resumo, proxima.n)
        .run();
      return json({ id }, 201);
    }
    if (primeiro && !segundo) {
      const id = texto(primeiro, 60, "id da equipe", true);
      if (metodo === "PATCH") {
        const dados = await corpoJson(request);
        const r = await env.DB.prepare("UPDATE equipes SET nome = ?, resumo = ?, ordem = ? WHERE id = ?")
          .bind(
            texto(dados.nome, LIMITES.equipeNome, "nome", true),
            texto(dados.resumo, LIMITES.resumo, "resumo"),
            inteiro(dados.ordem, 0),
            id,
          )
          .run();
        if (!r.meta.changes) throw new ErroApi("Equipe nao encontrada.", 404);
        return json({ ok: true });
      }
      if (metodo === "DELETE") {
        await env.DB.batch([
          env.DB.prepare("DELETE FROM membros WHERE equipe_id = ?").bind(id),
          env.DB.prepare("DELETE FROM escalas WHERE equipe_id = ?").bind(id),
          env.DB.prepare("DELETE FROM blocos WHERE pagina = ?").bind(`equipe:${id}`),
          env.DB.prepare("DELETE FROM equipes WHERE id = ?").bind(id),
        ]);
        return json({ ok: true });
      }
    }
  }

  /* ---- membros ---- */
  if (recurso === "membros") {
    if (!primeiro && metodo === "POST") {
      const dados = await corpoJson(request);
      const equipeId = texto(dados.equipe_id, 60, "equipe", true);
      const equipe = await env.DB.prepare("SELECT id FROM equipes WHERE id = ?").bind(equipeId).first();
      if (!equipe) throw new ErroApi("Equipe nao encontrada.", 404);
      const proxima = await env.DB.prepare(
        "SELECT IFNULL(MAX(ordem), 0) + 1 AS n FROM membros WHERE equipe_id = ?",
      )
        .bind(equipeId)
        .first();
      const criado = await env.DB.prepare(
        `INSERT INTO membros (equipe_id, nome, contato, observacao, ordem)
         VALUES (?, ?, ?, ?, ?) RETURNING id`,
      )
        .bind(
          equipeId,
          texto(dados.nome, LIMITES.nome, "nome", true),
          texto(dados.contato, LIMITES.contato, "contato"),
          texto(dados.observacao, LIMITES.resumo, "observacao"),
          proxima.n,
        )
        .first();
      return json({ id: criado.id }, 201);
    }
    if (primeiro && !segundo) {
      const id = idNumerico(primeiro);
      if (metodo === "PATCH") {
        const dados = await corpoJson(request);
        const r = await env.DB.prepare("UPDATE membros SET nome = ?, contato = ?, observacao = ? WHERE id = ?")
          .bind(
            texto(dados.nome, LIMITES.nome, "nome", true),
            texto(dados.contato, LIMITES.contato, "contato"),
            texto(dados.observacao, LIMITES.resumo, "observacao"),
            id,
          )
          .run();
        if (!r.meta.changes) throw new ErroApi("Membro nao encontrado.", 404);
        return json({ ok: true });
      }
      if (metodo === "DELETE") {
        await env.DB.prepare("DELETE FROM membros WHERE id = ?").bind(id).run();
        return json({ ok: true });
      }
    }
  }

  /* ---- blocos de conteudo ---- */
  if (recurso === "blocos") {
    if (primeiro === "ordenar" && metodo === "POST") {
      const dados = await corpoJson(request);
      const pagina = paginaValida(dados.pagina);
      const ids = Array.isArray(dados.ids) ? dados.ids.map(idNumerico).slice(0, 200) : [];
      if (ids.length) {
        await env.DB.batch(
          ids.map((id, i) =>
            env.DB.prepare("UPDATE blocos SET ordem = ? WHERE id = ? AND pagina = ?").bind(i + 1, id, pagina),
          ),
        );
      }
      return json({ ok: true });
    }
    if (!primeiro && metodo === "POST") {
      const dados = await corpoJson(request);
      const pagina = paginaValida(dados.pagina);
      const proxima = await env.DB.prepare(
        "SELECT IFNULL(MAX(ordem), 0) + 1 AS n FROM blocos WHERE pagina = ?",
      )
        .bind(pagina)
        .first();
      const criado = await env.DB.prepare(
        "INSERT INTO blocos (pagina, titulo, corpo, ordem) VALUES (?, ?, ?, ?) RETURNING id",
      )
        .bind(
          pagina,
          texto(dados.titulo, LIMITES.titulo, "titulo"),
          texto(dados.corpo, LIMITES.corpo, "corpo"),
          proxima.n,
        )
        .first();
      return json({ id: criado.id }, 201);
    }
    if (primeiro && !segundo) {
      const id = idNumerico(primeiro);
      if (metodo === "PATCH") {
        const dados = await corpoJson(request);
        const r = await env.DB.prepare(
          "UPDATE blocos SET titulo = ?, corpo = ?, atualizado_em = datetime('now') WHERE id = ?",
        )
          .bind(texto(dados.titulo, LIMITES.titulo, "titulo"), texto(dados.corpo, LIMITES.corpo, "corpo"), id)
          .run();
        if (!r.meta.changes) throw new ErroApi("Bloco nao encontrado.", 404);
        return json({ ok: true });
      }
      if (metodo === "DELETE") {
        await env.DB.prepare("DELETE FROM blocos WHERE id = ?").bind(id).run();
        return json({ ok: true });
      }
    }
  }

  return erro("Rota nao encontrada.", 404);
}

/* ------------------------------------------------------------------ */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      try {
        return await roteadorApi(request, env, url);
      } catch (e) {
        if (e instanceof ErroApi) return erro(e.message, e.status);
        console.error("Falha inesperada:", e);
        return erro("Erro interno no servidor.", 500);
      }
    }

    return env.ASSETS.fetch(request);
  },
};
