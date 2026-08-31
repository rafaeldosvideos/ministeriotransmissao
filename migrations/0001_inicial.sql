-- Sistema Ministerio de Transmissao — estrutura inicial

DROP TABLE IF EXISTS escalas;
DROP TABLE IF EXISTS membros;
DROP TABLE IF EXISTS blocos;
DROP TABLE IF EXISTS transmissoes;
DROP TABLE IF EXISTS equipes;
DROP TABLE IF EXISTS tentativas_login;

-- Equipes/funcoes do ministerio (camera central, grua, corte...).
CREATE TABLE equipes (
  id       TEXT PRIMARY KEY,
  nome     TEXT NOT NULL,
  resumo   TEXT NOT NULL DEFAULT '',
  ordem    INTEGER NOT NULL DEFAULT 0
);

-- Datas de transmissao inseridas manualmente pelo admin.
CREATE TABLE transmissoes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  data         TEXT NOT NULL,                 -- YYYY-MM-DD
  hora         TEXT NOT NULL DEFAULT '',      -- HH:MM
  titulo       TEXT NOT NULL,
  local        TEXT NOT NULL DEFAULT '',
  observacoes  TEXT NOT NULL DEFAULT '',
  criado_em    TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_transmissoes_data ON transmissoes (data);

-- Quem esta escalado em cada funcao, em cada data.
CREATE TABLE escalas (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  transmissao_id INTEGER NOT NULL REFERENCES transmissoes(id) ON DELETE CASCADE,
  equipe_id      TEXT NOT NULL,
  nome           TEXT NOT NULL,
  ordem          INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_escalas_transmissao ON escalas (transmissao_id);
CREATE INDEX idx_escalas_equipe ON escalas (equipe_id);

-- Pessoas que costumam servir em cada equipe (alimenta o autocomplete da escala).
CREATE TABLE membros (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  equipe_id  TEXT NOT NULL REFERENCES equipes(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  contato    TEXT NOT NULL DEFAULT '',
  observacao TEXT NOT NULL DEFAULT '',
  ordem      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_membros_equipe ON membros (equipe_id);

-- Blocos de conteudo editaveis. `pagina` aceita:
--   'geral'                  -> blocos extras da home
--   'instrucoes'             -> pagina de instrucoes
--   'equipe:<id_da_equipe>'  -> conteudo da pagina daquela equipe
-- E o que torna as paginas extensiveis sem mexer no codigo.
CREATE TABLE blocos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  pagina        TEXT NOT NULL,
  titulo        TEXT NOT NULL DEFAULT '',
  corpo         TEXT NOT NULL DEFAULT '',
  ordem         INTEGER NOT NULL DEFAULT 0,
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_blocos_pagina ON blocos (pagina, ordem);

-- Freio de forca bruta no PIN.
CREATE TABLE tentativas_login (
  ip            TEXT PRIMARY KEY,
  falhas        INTEGER NOT NULL DEFAULT 0,
  bloqueado_ate INTEGER NOT NULL DEFAULT 0
);
