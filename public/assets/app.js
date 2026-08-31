/**
 * Ministério de Transmissão — aplicação de página única.
 * Sem dependências: um fetch inicial em /api/estado alimenta as três páginas.
 */

/* ------------------------------------------------------------------ */
/* Estado                                                              */
/* ------------------------------------------------------------------ */

const estado = {
  dados: null,
  admin: false,
  carregando: true,
  falha: null,
  historicoAberto: false,
};

const alvo = document.getElementById("conteudo");
const raizModais = document.getElementById("modais");

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);

const ICONES = {
  lapis: '<path d="M4 20h4l10.5-10.5a2.6 2.6 0 0 0-3.7-3.7L4.3 16.3Z"/><path d="M13.8 7.3 16.7 10.2"/>',
  lixeira: '<path d="M4.5 6.5h15M9.5 6.5V4.8A1.3 1.3 0 0 1 10.8 3.5h2.4a1.3 1.3 0 0 1 1.3 1.3v1.7M6.4 6.5l.8 12.2a1.6 1.6 0 0 0 1.6 1.5h6.4a1.6 1.6 0 0 0 1.6-1.5l.8-12.2"/>',
  mais: '<path d="M12 5.5v13M5.5 12h13"/>',
  relogio: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.4V12l3 1.8"/>',
  pino: '<path d="M12 21s6.5-5.8 6.5-10.3A6.5 6.5 0 0 0 5.5 10.7C5.5 15.2 12 21 12 21Z"/><circle cx="12" cy="10.5" r="2.3"/>',
  fechar: '<path d="M6 6l12 12M18 6 6 18"/>',
  cima: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  baixo: '<path d="M12 5v14M18 13l-6 6-6-6"/>',
  pessoas: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.4 19.5a5.8 5.8 0 0 1 11.2 0"/><path d="M16.2 6.1a3.2 3.2 0 0 1 0 6.1M17.4 14.4a5.8 5.8 0 0 1 3.2 5.1"/>',
};

const icone = (nome, classe = "") =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" class="${classe}">${ICONES[nome]}</svg>`;

function aviso(mensagem, tipo = "ok") {
  const caixa = document.getElementById("avisos");
  const el = document.createElement("div");
  el.className = `aviso ${tipo === "erro" ? "aviso-erro" : ""}`;
  el.textContent = mensagem;
  caixa.appendChild(el);
  setTimeout(() => el.remove(), tipo === "erro" ? 5200 : 3200);
}

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

async function api(caminho, opcoes = {}) {
  const resposta = await fetch(caminho, {
    credentials: "same-origin",
    headers: opcoes.corpo ? { "content-type": "application/json" } : undefined,
    method: opcoes.metodo || "GET",
    body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined,
  });
  let dados = null;
  try {
    dados = await resposta.json();
  } catch {
    /* resposta sem corpo */
  }
  if (!resposta.ok) {
    const e = new Error((dados && dados.erro) || `Falha na requisição (${resposta.status}).`);
    e.status = resposta.status;
    throw e;
  }
  return dados;
}

async function carregar({ silencioso = false } = {}) {
  if (!silencioso) estado.carregando = true;
  try {
    const dados = await api(`/api/estado${estado.historicoAberto ? "?historico=1" : ""}`);
    estado.dados = dados;
    estado.admin = dados.admin;
    estado.falha = null;
  } catch (e) {
    estado.falha = e.message;
  } finally {
    estado.carregando = false;
    render();
  }
}

/* ------------------------------------------------------------------ */
/* Markdown leve (o conteúdo já vem escapado antes de virar HTML)      */
/* ------------------------------------------------------------------ */

function inline(texto) {
  return texto
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    );
}

function md(bruto) {
  const linhas = esc(bruto).split(/\r?\n/);
  const saida = [];
  let lista = null; // 'ul' | 'ol'
  let paragrafo = [];

  const fechaParagrafo = () => {
    if (paragrafo.length) {
      saida.push(`<p>${inline(paragrafo.join("<br>"))}</p>`);
      paragrafo = [];
    }
  };
  const fechaLista = () => {
    if (lista) {
      saida.push(`</${lista}>`);
      lista = null;
    }
  };

  for (const linha of linhas) {
    const l = linha.trim();

    if (!l) {
      fechaParagrafo();
      fechaLista();
      continue;
    }
    if (/^(---+|\*\*\*+)$/.test(l)) {
      fechaParagrafo();
      fechaLista();
      saida.push("<hr>");
      continue;
    }
    const cabecalho = l.match(/^(#{1,4})\s+(.*)$/);
    if (cabecalho) {
      fechaParagrafo();
      fechaLista();
      const nivel = Math.min(4, cabecalho[1].length + 2);
      saida.push(`<h${nivel}>${inline(cabecalho[2])}</h${nivel}>`);
      continue;
    }
    const citacao = l.match(/^&gt;\s?(.*)$/);
    if (citacao) {
      fechaParagrafo();
      fechaLista();
      saida.push(`<blockquote>${inline(citacao[1])}</blockquote>`);
      continue;
    }
    const item = l.match(/^([-*])\s+(.*)$/);
    if (item) {
      fechaParagrafo();
      if (lista !== "ul") {
        fechaLista();
        saida.push("<ul>");
        lista = "ul";
      }
      saida.push(`<li>${inline(item[2])}</li>`);
      continue;
    }
    const numerado = l.match(/^\d+[.)]\s+(.*)$/);
    if (numerado) {
      fechaParagrafo();
      if (lista !== "ol") {
        fechaLista();
        saida.push("<ol>");
        lista = "ol";
      }
      saida.push(`<li>${inline(numerado[1])}</li>`);
      continue;
    }
    fechaLista();
    paragrafo.push(l);
  }
  fechaParagrafo();
  fechaLista();
  return saida.join("\n");
}

/* ------------------------------------------------------------------ */
/* Datas                                                               */
/* ------------------------------------------------------------------ */

const fmtDiaSemana = new Intl.DateTimeFormat("pt-BR", { weekday: "long" });
const fmtMesCurto = new Intl.DateTimeFormat("pt-BR", { month: "short" });
const fmtCompleta = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

function paraData(iso) {
  const [a, m, d] = String(iso).split("-").map(Number);
  return new Date(a, m - 1, d);
}

const maiuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const mesCurto = (data) => fmtMesCurto.format(data).replace(/\./g, "").toUpperCase();

function diasEntre(isoA, isoB) {
  return Math.round((paraData(isoB) - paraData(isoA)) / 86400000);
}

function rotuloRelativo(dias) {
  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias < 0) return null;
  if (dias < 7) return `em ${dias} dias`;
  if (dias < 14) return "na próxima semana";
  if (dias < 31) return `em ${Math.round(dias / 7)} semanas`;
  return null;
}

/* ------------------------------------------------------------------ */
/* Roteador                                                            */
/* ------------------------------------------------------------------ */

function rotaAtual() {
  const caminho = location.pathname.replace(/\/+$/, "") || "/";
  if (caminho === "/instrucoes") return { pagina: "instrucoes" };
  if (caminho === "/equipes") return { pagina: "equipes", equipeId: null };
  const m = caminho.match(/^\/equipes\/([a-z0-9-]+)$/);
  if (m) return { pagina: "equipes", equipeId: m[1] };
  return { pagina: "geral" };
}

function navegar(href, { substituir = false } = {}) {
  if (substituir) history.replaceState({}, "", href);
  else history.pushState({}, "", href);
  render();
  if (!substituir) window.scrollTo({ top: 0, behavior: "instant" });
}

document.addEventListener("click", (ev) => {
  const link = ev.target.closest("a[data-link], a[href^='/']");
  if (!link || link.target === "_blank" || ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
  const url = new URL(link.href, location.origin);
  if (url.origin !== location.origin) return;
  ev.preventDefault();
  navegar(url.pathname);
});

window.addEventListener("popstate", () => render());

/* ------------------------------------------------------------------ */
/* Blocos de conteúdo                                                  */
/* ------------------------------------------------------------------ */

function htmlBloco(bloco, pagina, indice, total) {
  const acoes = estado.admin
    ? `<div class="bloco-acoes">
         ${indice > 0 ? `<button type="button" class="btn btn-fantasma btn-pequeno" data-acao="mover-bloco" data-pagina="${esc(pagina)}" data-id="${bloco.id}" data-direcao="-1" aria-label="Mover para cima">${icone("cima")}</button>` : ""}
         ${indice < total - 1 ? `<button type="button" class="btn btn-fantasma btn-pequeno" data-acao="mover-bloco" data-pagina="${esc(pagina)}" data-id="${bloco.id}" data-direcao="1" aria-label="Mover para baixo">${icone("baixo")}</button>` : ""}
         <button type="button" class="btn btn-fantasma btn-pequeno" data-acao="editar-bloco" data-id="${bloco.id}" data-pagina="${esc(pagina)}" aria-label="Editar bloco">${icone("lapis")}</button>
         <button type="button" class="btn btn-perigo btn-pequeno" data-acao="apagar-bloco" data-id="${bloco.id}" aria-label="Apagar bloco">${icone("lixeira")}</button>
       </div>`
    : "";
  return `<article class="bloco">
    ${acoes}
    ${bloco.titulo ? `<h3>${esc(bloco.titulo)}</h3>` : ""}
    <div class="prosa">${md(bloco.corpo)}</div>
  </article>`;
}

function htmlBlocos(pagina, { rotuloVazio = "Nenhum conteúdo publicado ainda." } = {}) {
  const lista = (estado.dados.blocos || {})[pagina] || [];
  const botao = estado.admin
    ? `<button type="button" class="btn btn-secundario" data-acao="novo-bloco" data-pagina="${esc(pagina)}">${icone("mais")} Adicionar bloco</button>`
    : "";

  if (!lista.length) {
    return `<div class="vazio">
      <strong>${esc(rotuloVazio)}</strong>
      ${estado.admin ? "<p>Adicione um bloco de texto com orientações, avisos ou checklists.</p>" : "<p>A liderança da equipe ainda vai publicar as informações desta página.</p>"}
      ${botao}
    </div>`;
  }

  return `<div class="blocos">
    ${lista.map((b, i) => htmlBloco(b, pagina, i, lista.length)).join("")}
  </div>
  ${botao ? `<div style="margin-top:14px">${botao}</div>` : ""}`;
}

/* ------------------------------------------------------------------ */
/* Página: Geral                                                       */
/* ------------------------------------------------------------------ */

function htmlEscala(transmissao) {
  return `<div class="escala">
    ${estado.dados.equipes
      .map((equipe) => {
        const nomes = transmissao.escala[equipe.id] || [];
        return `<div class="escala-item">
          <span class="escala-funcao">${esc(equipe.nome)}</span>
          <span class="escala-nomes">${
            nomes.length
              ? nomes.map((n) => `<span class="pessoa">${esc(n)}</span>`).join("")
              : '<span class="vazio-inline">a definir</span>'
          }</span>
        </div>`;
      })
      .join("")}
  </div>`;
}

function htmlTransmissao(t, { destaque = false } = {}) {
  const data = paraData(t.data);
  const dias = diasEntre(estado.dados.hoje, t.data);
  const relativo = rotuloRelativo(dias);

  const etiqueta = destaque
    ? dias === 0
      ? '<span class="etiqueta etiqueta-hoje">Hoje</span>'
      : '<span class="etiqueta etiqueta-destaque">Próxima</span>'
    : relativo
      ? `<span class="etiqueta">${esc(relativo)}</span>`
      : "";

  const acoes = estado.admin
    ? `<div class="acoes-cartao">
         <button type="button" class="btn btn-fantasma btn-pequeno" data-acao="editar-transmissao" data-id="${t.id}" aria-label="Editar data">${icone("lapis")}</button>
         <button type="button" class="btn btn-perigo btn-pequeno" data-acao="apagar-transmissao" data-id="${t.id}" aria-label="Apagar data">${icone("lixeira")}</button>
       </div>`
    : "";

  return `<article class="cartao transmissao ${destaque ? "proxima" : ""}">
    <div class="transmissao-topo">
      <div class="data-bloco">
        <span class="data-dia">${String(data.getDate()).padStart(2, "0")}</span>
        <span class="data-mes">${mesCurto(data)}</span>
      </div>
      <div class="transmissao-info">
        <h3>${esc(t.titulo)}</h3>
        <div class="transmissao-meta">
          <span>${maiuscula(fmtDiaSemana.format(data))}</span>
          ${t.hora ? `<span>${icone("relogio")}${esc(t.hora)}</span>` : ""}
          ${t.local ? `<span>${icone("pino")}${esc(t.local)}</span>` : ""}
        </div>
      </div>
      ${etiqueta}
      ${acoes}
    </div>
    ${htmlEscala(t)}
    ${t.observacoes ? `<div class="observacao-transmissao">${md(t.observacoes)}</div>` : ""}
  </article>`;
}

function renderGeral() {
  const { transmissoes, hoje } = estado.dados;
  const futuras = transmissoes.filter((t) => t.data >= hoje);
  const passadas = transmissoes.filter((t) => t.data < hoje).reverse();

  const botaoNova = estado.admin
    ? `<button type="button" class="btn" data-acao="nova-transmissao">${icone("mais")} Nova data</button>`
    : "";

  let corpoFuturas;
  if (!futuras.length) {
    corpoFuturas = `<div class="vazio">
      <strong>Nenhuma data de transmissão cadastrada</strong>
      <p>${
        estado.admin
          ? "Cadastre a próxima data e defina quem fica em cada função."
          : "Assim que a liderança publicar a próxima escala, ela aparece aqui."
      }</p>
      ${botaoNova}
    </div>`;
  } else {
    corpoFuturas = `<div class="lista-cartoes">
      ${htmlTransmissao(futuras[0], { destaque: true })}
      ${futuras.slice(1).map((t) => htmlTransmissao(t)).join("")}
    </div>`;
  }

  const historico = passadas.length
    ? `<section class="secao">
        <h2>Já transmitido</h2>
        <div class="cartao">
          ${passadas
            .map((t) => {
              const nomes = Object.values(t.escala).flat();
              return `<div class="linha-historico">
                <span class="data-curta">${fmtCompleta.format(paraData(t.data))}</span>
                <span class="titulo-curto">${esc(t.titulo)}</span>
                <span class="vazio-inline">${nomes.length ? `${nomes.length} escalado(s)` : "sem escala"}</span>
                ${
                  estado.admin
                    ? `<div class="acoes-cartao">
                        <button type="button" class="btn btn-fantasma btn-pequeno" data-acao="editar-transmissao" data-id="${t.id}" aria-label="Editar">${icone("lapis")}</button>
                        <button type="button" class="btn btn-perigo btn-pequeno" data-acao="apagar-transmissao" data-id="${t.id}" aria-label="Apagar">${icone("lixeira")}</button>
                      </div>`
                    : ""
                }
              </div>`;
            })
            .join("")}
        </div>
        ${
          !estado.dados.historicoCompleto
            ? `<div style="margin-top:12px"><button type="button" class="btn btn-secundario btn-pequeno" data-acao="ver-historico">Ver histórico completo</button></div>`
            : ""
        }
      </section>`
    : "";

  return `
    <div class="cabecalho-pagina">
      <div>
        <h1>Próximas transmissões</h1>
        <p class="subtitulo">Quem está escalado em cada função, por data.</p>
      </div>
      ${futuras.length ? botaoNova : ""}
    </div>
    ${corpoFuturas}
    ${historico}
    <section class="secao">
      <h2>Avisos e informações</h2>
      ${htmlBlocos("geral", { rotuloVazio: "Nenhum aviso publicado" })}
    </section>`;
}

/* ------------------------------------------------------------------ */
/* Página: Equipes                                                     */
/* ------------------------------------------------------------------ */

function renderEquipes(equipeId) {
  const { equipes, membros, transmissoes, hoje } = estado.dados;

  if (!equipes.length) {
    return `<div class="cabecalho-pagina"><div><h1>Equipes</h1></div></div>
      <div class="vazio">
        <strong>Nenhuma equipe cadastrada</strong>
        <p>Crie as funções do ministério para começar a montar a escala.</p>
        ${estado.admin ? `<button type="button" class="btn" data-acao="nova-equipe">${icone("mais")} Nova equipe</button>` : ""}
      </div>`;
  }

  const equipe = equipes.find((e) => e.id === equipeId) || equipes[0];
  if (equipe.id !== equipeId) {
    history.replaceState({}, "", `/equipes/${equipe.id}`);
  }

  const submenu = `<nav class="submenu" aria-label="Equipes">
    <span class="submenu-titulo">Equipes</span>
    ${equipes
      .map((e) => {
        const qtd = (membros[e.id] || []).length;
        return `<a href="/equipes/${esc(e.id)}" data-link ${e.id === equipe.id ? 'aria-current="page"' : ""}>
          <span>${esc(e.nome)}</span>
          ${qtd ? `<span class="submenu-numero">${qtd}</span>` : ""}
        </a>`;
      })
      .join("")}
    ${
      estado.admin
        ? `<button type="button" class="btn btn-fantasma btn-pequeno" data-acao="nova-equipe" style="justify-content:flex-start;margin-top:4px">${icone("mais")} Nova equipe</button>`
        : ""
    }
  </nav>`;

  const daEquipe = (membros[equipe.id] || [])
    .map(
      (m) => `<div class="membro">
        <span class="avatar" aria-hidden="true">${esc(m.nome.trim().charAt(0).toUpperCase())}</span>
        <div class="membro-dados">
          <strong>${esc(m.nome)}</strong>
          ${m.contato ? `<small>${esc(m.contato)}</small>` : ""}
          ${m.observacao ? `<small>${esc(m.observacao)}</small>` : ""}
        </div>
        ${
          estado.admin
            ? `<div class="acoes-cartao">
                <button type="button" class="btn btn-fantasma btn-pequeno" data-acao="editar-membro" data-id="${m.id}" data-equipe="${esc(equipe.id)}" aria-label="Editar membro">${icone("lapis")}</button>
                <button type="button" class="btn btn-perigo btn-pequeno" data-acao="apagar-membro" data-id="${m.id}" aria-label="Remover membro">${icone("lixeira")}</button>
              </div>`
            : ""
        }
      </div>`,
    )
    .join("");

  const proximas = transmissoes
    .filter((t) => t.data >= hoje && (t.escala[equipe.id] || []).length)
    .slice(0, 6)
    .map(
      (t) => `<div class="linha-historico">
        <span class="data-curta">${fmtCompleta.format(paraData(t.data))}</span>
        <span class="titulo-curto">${esc(t.titulo)}</span>
        <span class="escala-nomes">${(t.escala[equipe.id] || []).map((n) => `<span class="pessoa">${esc(n)}</span>`).join("")}</span>
      </div>`,
    )
    .join("");

  const conteudo = `
    <div class="equipe-cabecalho">
      <div style="flex:1;min-width:220px">
        <h1>${esc(equipe.nome)}</h1>
        ${equipe.resumo ? `<p class="subtitulo">${esc(equipe.resumo)}</p>` : ""}
      </div>
      ${
        estado.admin
          ? `<div class="acoes-cartao">
              <button type="button" class="btn btn-secundario btn-pequeno" data-acao="editar-equipe" data-id="${esc(equipe.id)}">${icone("lapis")} Editar equipe</button>
              <button type="button" class="btn btn-perigo btn-pequeno" data-acao="apagar-equipe" data-id="${esc(equipe.id)}" aria-label="Apagar equipe">${icone("lixeira")}</button>
            </div>`
          : ""
      }
    </div>

    <section class="secao" style="margin-top:26px">
      <h2>Como funciona</h2>
      ${htmlBlocos(`equipe:${equipe.id}`, { rotuloVazio: "Sem orientações publicadas" })}
    </section>

    <section class="secao">
      <h2>Quem serve nesta equipe</h2>
      ${
        daEquipe
          ? `<div class="grade-membros">${daEquipe}</div>`
          : `<div class="vazio"><strong>Nenhuma pessoa cadastrada</strong><p>Cadastre a equipe para agilizar o preenchimento da escala.</p></div>`
      }
      ${
        estado.admin
          ? `<div style="margin-top:12px"><button type="button" class="btn btn-secundario" data-acao="novo-membro" data-equipe="${esc(equipe.id)}">${icone("mais")} Adicionar pessoa</button></div>`
          : ""
      }
    </section>

    <section class="secao">
      <h2>Próximas escalas desta equipe</h2>
      ${
        proximas
          ? `<div class="cartao">${proximas}</div>`
          : `<div class="vazio"><strong>Ninguém escalado ainda</strong><p>As datas com escala desta função aparecem aqui.</p></div>`
      }
    </section>`;

  return `<div class="equipes-layout">${submenu}<div>${conteudo}</div></div>`;
}

/* ------------------------------------------------------------------ */
/* Página: Instruções                                                  */
/* ------------------------------------------------------------------ */

function renderInstrucoes() {
  return `
    <div class="cabecalho-pagina">
      <div>
        <h1>Instruções</h1>
        <p class="subtitulo">Combinados e procedimentos que valem para todas as funções.</p>
      </div>
    </div>
    <div style="max-width:760px">${htmlBlocos("instrucoes", { rotuloVazio: "Nenhuma instrução publicada" })}</div>`;
}

/* ------------------------------------------------------------------ */
/* Render principal                                                    */
/* ------------------------------------------------------------------ */

function render() {
  const rota = rotaAtual();

  document.querySelectorAll(".nav-principal a").forEach((a) => {
    if (a.dataset.nav === rota.pagina) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });

  if (estado.carregando) {
    alvo.innerHTML = '<div class="carregando" role="status"><span class="giro"></span> Carregando…</div>';
    return;
  }
  if (estado.falha) {
    alvo.innerHTML = `<div class="vazio">
      <strong>Não foi possível carregar</strong>
      <p>${esc(estado.falha)}</p>
      <button type="button" class="btn" data-acao="recarregar">Tentar de novo</button>
    </div>`;
    return;
  }

  document.getElementById("barra-edicao").hidden = !estado.admin;
  const btnEditar = document.getElementById("btn-editar");
  btnEditar.hidden = estado.admin;

  if (rota.pagina === "equipes") alvo.innerHTML = renderEquipes(rota.equipeId);
  else if (rota.pagina === "instrucoes") alvo.innerHTML = renderInstrucoes();
  else alvo.innerHTML = renderGeral();

  // No celular o submenu vira uma faixa horizontal: traz a equipe atual para a vista.
  const ativo = alvo.querySelector('.submenu a[aria-current="page"]');
  if (ativo) {
    const menu = ativo.parentElement;
    if (menu.scrollWidth > menu.clientWidth) {
      menu.scrollLeft = ativo.offsetLeft - (menu.clientWidth - ativo.offsetWidth) / 2;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Modais                                                              */
/* ------------------------------------------------------------------ */

function abrirModal({ titulo, corpo, salvar = "Salvar", extras = "", perigo = false, aoConfirmar, aoFechar }) {
  const anterior = document.activeElement;
  const fundo = document.createElement("div");
  fundo.className = "fundo-modal";
  fundo.innerHTML = `
    <form class="modal" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
      <div class="modal-topo">
        <h2>${esc(titulo)}</h2>
        <button type="button" class="btn-icone" data-fechar aria-label="Fechar">${icone("fechar")}</button>
      </div>
      <div class="modal-corpo">
        <div class="erro-form" hidden></div>
        ${corpo}
      </div>
      <div class="modal-rodape">
        ${extras}
        <button type="button" class="btn btn-secundario" data-fechar>Cancelar</button>
        <button type="submit" class="btn ${perigo ? "btn-confirmar-perigo" : ""}">${esc(salvar)}</button>
      </div>
    </form>`;
  raizModais.appendChild(fundo);

  const form = fundo.querySelector("form");
  const caixaErro = fundo.querySelector(".erro-form");
  const botaoSalvar = form.querySelector('button[type="submit"]');

  const fechar = () => {
    if (!fundo.isConnected) return;
    fundo.remove();
    document.removeEventListener("keydown", aoTeclar);
    if (aoFechar) aoFechar();
    if (anterior && anterior.focus) anterior.focus();
  };
  const aoTeclar = (ev) => {
    if (ev.key === "Escape") fechar();
  };
  document.addEventListener("keydown", aoTeclar);

  fundo.addEventListener("click", (ev) => {
    if (ev.target === fundo || ev.target.closest("[data-fechar]")) fechar();
  });

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    caixaErro.hidden = true;
    botaoSalvar.disabled = true;
    try {
      await aoConfirmar({ form, fechar });
    } catch (e) {
      caixaErro.textContent = e.message;
      caixaErro.hidden = false;
    } finally {
      botaoSalvar.disabled = false;
    }
  });

  const primeiro = form.querySelector("input, textarea, select");
  if (primeiro) setTimeout(() => primeiro.focus(), 40);

  return { fundo, form, fechar };
}

function confirmar(titulo, texto, rotuloOk = "Apagar") {
  return new Promise((resolve) => {
    let respondido = false;
    const responder = (valor) => {
      if (respondido) return;
      respondido = true;
      resolve(valor);
    };
    abrirModal({
      titulo,
      perigo: true,
      salvar: rotuloOk,
      corpo: `<p style="color:var(--fraco);font-size:14px">${esc(texto)}</p>`,
      aoConfirmar: ({ fechar }) => {
        responder(true);
        fechar();
      },
      aoFechar: () => responder(false),
    });
  });
}

/* ------------------------------------------------------------------ */
/* Modal: PIN                                                          */
/* ------------------------------------------------------------------ */

function modalPin() {
  abrirModal({
    titulo: "Entrar no modo edição",
    salvar: "Entrar",
    corpo: `
      <p style="color:var(--fraco);font-size:13.5px;margin-bottom:16px">
        A visualização é livre para todos. O PIN libera a edição da escala e dos textos.
      </p>
      <div class="campo">
        <label for="pin">PIN de edição</label>
        <input type="password" id="pin" name="pin" autocomplete="current-password" required>
      </div>`,
    aoConfirmar: async ({ form, fechar }) => {
      await api("/api/sessao", { metodo: "POST", corpo: { pin: form.pin.value } });
      fechar();
      aviso("Modo edição liberado.");
      await carregar({ silencioso: true });
    },
  });
}

/* ------------------------------------------------------------------ */
/* Modal: transmissão                                                  */
/* ------------------------------------------------------------------ */

function modalTransmissao(transmissao) {
  const t = transmissao || { data: "", hora: "19:00", titulo: "", local: "", observacoes: "", escala: {} };
  const membros = estado.dados.membros || {};

  const camposEscala = estado.dados.equipes
    .map((equipe) => {
      const nomes = (t.escala[equipe.id] || []).join(", ");
      const sugestoes = (membros[equipe.id] || [])
        .map(
          (m) =>
            `<button type="button" class="sugestao" data-acao="sugerir" data-alvo="esc-${esc(equipe.id)}" data-nome="${esc(m.nome)}">+ ${esc(m.nome)}</button>`,
        )
        .join("");
      return `<div class="campo-escala">
        <label for="esc-${esc(equipe.id)}">${esc(equipe.nome)}</label>
        <div>
          <input type="text" id="esc-${esc(equipe.id)}" data-equipe="${esc(equipe.id)}"
                 value="${esc(nomes)}" placeholder="Nomes separados por vírgula">
          ${sugestoes ? `<div class="sugestoes">${sugestoes}</div>` : ""}
        </div>
      </div>`;
    })
    .join("");

  const { fundo } = abrirModal({
    titulo: transmissao ? "Editar data" : "Nova data de transmissão",
    salvar: transmissao ? "Salvar alterações" : "Cadastrar",
    corpo: `
      <div class="linha-campos">
        <div class="campo">
          <label for="data">Data</label>
          <input type="date" id="data" name="data" value="${esc(t.data)}" required>
        </div>
        <div class="campo">
          <label for="hora">Horário</label>
          <input type="time" id="hora" name="hora" value="${esc(t.hora)}">
        </div>
      </div>
      <div class="campo">
        <label for="titulo">Evento</label>
        <input type="text" id="titulo" name="titulo" value="${esc(t.titulo)}" placeholder="Culto de domingo" required maxlength="120">
      </div>
      <div class="campo">
        <label for="local">Local <span class="dica">(opcional)</span></label>
        <input type="text" id="local" name="local" value="${esc(t.local)}" placeholder="Templo sede" maxlength="120">
      </div>

      <div class="campo" style="margin-top:22px">
        <label style="font-size:12px;text-transform:uppercase;letter-spacing:.08em">Escala</label>
        <div class="campos-escala">${camposEscala}</div>
      </div>

      <div class="campo">
        <label for="observacoes">Observações <span class="dica">(opcional)</span></label>
        <textarea id="observacoes" name="observacoes" style="min-height:80px" maxlength="2000"
          placeholder="Ex.: chegar 1h antes, ensaio da banda às 17h">${esc(t.observacoes)}</textarea>
      </div>`,
    aoConfirmar: async ({ form, fechar }) => {
      const escala = {};
      form.querySelectorAll("input[data-equipe]").forEach((campo) => {
        escala[campo.dataset.equipe] = campo.value
          .split(/[,;]/)
          .map((n) => n.trim())
          .filter(Boolean);
      });
      const corpo = {
        data: form.data.value,
        hora: form.hora.value,
        titulo: form.titulo.value,
        local: form.local.value,
        observacoes: form.observacoes.value,
        escala,
      };
      if (transmissao) await api(`/api/transmissoes/${transmissao.id}`, { metodo: "PUT", corpo });
      else await api("/api/transmissoes", { metodo: "POST", corpo });
      fechar();
      aviso(transmissao ? "Data atualizada." : "Data cadastrada.");
      await carregar({ silencioso: true });
    },
  });

  fundo.addEventListener("click", (ev) => {
    const botao = ev.target.closest('[data-acao="sugerir"]');
    if (!botao) return;
    const campo = fundo.querySelector(`#${CSS.escape(botao.dataset.alvo)}`);
    const nomes = campo.value.split(/[,;]/).map((n) => n.trim()).filter(Boolean);
    if (!nomes.includes(botao.dataset.nome)) nomes.push(botao.dataset.nome);
    campo.value = nomes.join(", ");
  });
}

/* ------------------------------------------------------------------ */
/* Modais: bloco, membro, equipe                                       */
/* ------------------------------------------------------------------ */

function modalBloco(pagina, bloco) {
  abrirModal({
    titulo: bloco ? "Editar bloco" : "Novo bloco de conteúdo",
    salvar: bloco ? "Salvar" : "Publicar",
    corpo: `
      <div class="campo">
        <label for="titulo">Título <span class="dica">(opcional)</span></label>
        <input type="text" id="titulo" name="titulo" value="${esc(bloco ? bloco.titulo : "")}" maxlength="120">
      </div>
      <div class="campo">
        <label for="corpo">Conteúdo</label>
        <textarea id="corpo" name="corpo" maxlength="20000" placeholder="Escreva aqui…">${esc(bloco ? bloco.corpo : "")}</textarea>
        <span class="dica">Formatação: <code>**negrito**</code>, <code>*itálico*</code>, <code>- lista</code>, <code>1. numerada</code>, <code>## subtítulo</code>, <code>&gt; destaque</code>.</span>
      </div>`,
    aoConfirmar: async ({ form, fechar }) => {
      const corpo = { pagina, titulo: form.titulo.value, corpo: form.corpo.value };
      if (bloco) await api(`/api/blocos/${bloco.id}`, { metodo: "PATCH", corpo });
      else await api("/api/blocos", { metodo: "POST", corpo });
      fechar();
      aviso("Conteúdo salvo.");
      await carregar({ silencioso: true });
    },
  });
}

function modalMembro(equipeId, membro) {
  abrirModal({
    titulo: membro ? "Editar pessoa" : "Adicionar pessoa",
    corpo: `
      <div class="campo">
        <label for="nome">Nome</label>
        <input type="text" id="nome" name="nome" value="${esc(membro ? membro.nome : "")}" required maxlength="80">
      </div>
      <div class="campo">
        <label for="contato">Contato <span class="dica">(opcional)</span></label>
        <input type="text" id="contato" name="contato" value="${esc(membro ? membro.contato : "")}" placeholder="WhatsApp, e-mail…" maxlength="120">
      </div>
      <div class="campo">
        <label for="observacao">Observação <span class="dica">(opcional)</span></label>
        <input type="text" id="observacao" name="observacao" value="${esc(membro ? membro.observacao : "")}" placeholder="Ex.: disponível só aos domingos" maxlength="300">
      </div>`,
    aoConfirmar: async ({ form, fechar }) => {
      const corpo = {
        equipe_id: equipeId,
        nome: form.nome.value,
        contato: form.contato.value,
        observacao: form.observacao.value,
      };
      if (membro) await api(`/api/membros/${membro.id}`, { metodo: "PATCH", corpo });
      else await api("/api/membros", { metodo: "POST", corpo });
      fechar();
      aviso("Equipe atualizada.");
      await carregar({ silencioso: true });
    },
  });
}

function modalEquipe(equipe) {
  abrirModal({
    titulo: equipe ? "Editar equipe" : "Nova equipe",
    corpo: `
      <div class="campo">
        <label for="nome">Nome da equipe</label>
        <input type="text" id="nome" name="nome" value="${esc(equipe ? equipe.nome : "")}" required maxlength="60" placeholder="Ex.: Áudio">
      </div>
      <div class="campo">
        <label for="resumo">Resumo <span class="dica">(uma linha, aparece abaixo do título)</span></label>
        <input type="text" id="resumo" name="resumo" value="${esc(equipe ? equipe.resumo : "")}" maxlength="300">
      </div>`,
    aoConfirmar: async ({ form, fechar }) => {
      const corpo = { nome: form.nome.value, resumo: form.resumo.value, ordem: equipe ? equipe.ordem : 0 };
      if (equipe) {
        await api(`/api/equipes/${equipe.id}`, { metodo: "PATCH", corpo });
        fechar();
        aviso("Equipe atualizada.");
        await carregar({ silencioso: true });
      } else {
        const criada = await api("/api/equipes", { metodo: "POST", corpo });
        fechar();
        aviso("Equipe criada.");
        await carregar({ silencioso: true });
        navegar(`/equipes/${criada.id}`);
      }
    },
  });
}

/* ------------------------------------------------------------------ */
/* Ações                                                               */
/* ------------------------------------------------------------------ */

const acharTransmissao = (id) => estado.dados.transmissoes.find((t) => t.id === Number(id));
const acharBloco = (pagina, id) =>
  ((estado.dados.blocos || {})[pagina] || []).find((b) => b.id === Number(id));
const acharMembro = (equipeId, id) =>
  ((estado.dados.membros || {})[equipeId] || []).find((m) => m.id === Number(id));

async function comErro(fn) {
  try {
    await fn();
  } catch (e) {
    aviso(e.message, "erro");
    if (e.status === 401) {
      estado.admin = false;
      render();
    }
  }
}

alvo.addEventListener("click", (ev) => {
  const botao = ev.target.closest("[data-acao]");
  if (!botao) return;
  const { acao, id, pagina, equipe, direcao } = botao.dataset;

  const rotas = {
    recarregar: () => carregar(),
    "ver-historico": () => {
      estado.historicoAberto = true;
      carregar();
    },
    "nova-transmissao": () => modalTransmissao(null),
    "editar-transmissao": () => modalTransmissao(acharTransmissao(id)),
    "apagar-transmissao": async () => {
      const t = acharTransmissao(id);
      if (!(await confirmar("Apagar data", `A data "${t.titulo}" e a escala dela serão removidas.`))) return;
      await comErro(async () => {
        await api(`/api/transmissoes/${id}`, { metodo: "DELETE" });
        aviso("Data removida.");
        await carregar({ silencioso: true });
      });
    },
    "novo-bloco": () => modalBloco(pagina, null),
    "editar-bloco": () => modalBloco(pagina, acharBloco(pagina, id)),
    "apagar-bloco": async () => {
      if (!(await confirmar("Apagar bloco", "Este conteúdo será removido da página."))) return;
      await comErro(async () => {
        await api(`/api/blocos/${id}`, { metodo: "DELETE" });
        aviso("Bloco removido.");
        await carregar({ silencioso: true });
      });
    },
    "mover-bloco": () =>
      comErro(async () => {
        const lista = [...((estado.dados.blocos || {})[pagina] || [])];
        const i = lista.findIndex((b) => b.id === Number(id));
        const j = i + Number(direcao);
        if (i < 0 || j < 0 || j >= lista.length) return;
        [lista[i], lista[j]] = [lista[j], lista[i]];
        await api("/api/blocos/ordenar", {
          metodo: "POST",
          corpo: { pagina, ids: lista.map((b) => b.id) },
        });
        await carregar({ silencioso: true });
      }),
    "nova-equipe": () => modalEquipe(null),
    "editar-equipe": () => modalEquipe(estado.dados.equipes.find((e) => e.id === id)),
    "apagar-equipe": async () => {
      const e = estado.dados.equipes.find((x) => x.id === id);
      if (
        !(await confirmar(
          "Apagar equipe",
          `A equipe "${e.nome}", seus membros, seus textos e as escalas dela serão removidos.`,
        ))
      )
        return;
      await comErro(async () => {
        await api(`/api/equipes/${id}`, { metodo: "DELETE" });
        aviso("Equipe removida.");
        await carregar({ silencioso: true });
        navegar("/equipes", { substituir: true });
      });
    },
    "novo-membro": () => modalMembro(equipe, null),
    "editar-membro": () => modalMembro(equipe, acharMembro(equipe, id)),
    "apagar-membro": async () => {
      if (!(await confirmar("Remover pessoa", "Ela sai da lista da equipe (as escalas já salvas continuam)."))) return;
      await comErro(async () => {
        await api(`/api/membros/${id}`, { metodo: "DELETE" });
        aviso("Pessoa removida.");
        await carregar({ silencioso: true });
      });
    },
  };

  const fn = rotas[acao];
  if (fn) fn();
});

/* ------------------------------------------------------------------ */
/* Topo: tema, login, logout                                           */
/* ------------------------------------------------------------------ */

document.getElementById("btn-tema").addEventListener("click", () => {
  const atual =
    document.documentElement.dataset.tema ||
    (matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro");
  const novo = atual === "escuro" ? "claro" : "escuro";
  document.documentElement.dataset.tema = novo;
  try {
    localStorage.setItem("mt-tema", novo);
  } catch {
    /* modo privado */
  }
});

document.getElementById("btn-editar").addEventListener("click", () => {
  if (estado.dados && !estado.dados.configurado) {
    aviso("O PIN ainda não foi configurado no servidor. Veja o README.", "erro");
    return;
  }
  modalPin();
});

document.getElementById("btn-sair").addEventListener("click", () =>
  comErro(async () => {
    await api("/api/sessao", { metodo: "DELETE" });
    aviso("Você saiu do modo edição.");
    await carregar({ silencioso: true });
  }),
);

/* ------------------------------------------------------------------ */

render();
carregar();
