# Sistema — Ministério de Transmissão

Site da escala do ministério de transmissão da igreja. **Qualquer pessoa vê**;
**só quem tem o PIN edita**. Sem cadastro, sem login por usuário, sem senha individual.

Roda inteiro na Cloudflare: um Worker serve o site e a API, e o banco é o D1.
Sem framework, sem build — o que está em `public/` é o que vai pro ar.

## Páginas

| Página | O que tem |
|---|---|
| **Geral** (`/`) | Próximas datas de transmissão com quem está escalado em cada função, histórico e blocos livres de avisos |
| **Equipes** (`/equipes/...`) | Menu lateral fixo com as funções (Câmera Central, Câmera Móvel, Grua, Corte, Computador). Cada uma tem orientações, quem serve nela e as próximas escalas |
| **Instruções** (`/instrucoes`) | Combinados que valem para todo mundo |

A escala é **manual**: o admin cadastra a data e digita quem fica em cada função.
Não existe geração automática de escala.

## Subir pela primeira vez

Precisa de uma conta Cloudflare e do Node instalado.

```bash
npm install
npx wrangler login
```

**1. Criar o banco**

```bash
npm run db:criar
```

O comando devolve um `database_id`. Cole ele em `wrangler.jsonc`, no lugar de
`SUBSTITUA_PELO_ID_DO_D1`.

**2. Criar as tabelas e o conteúdo inicial**

```bash
npm run db:migrar    # estrutura
npm run db:seed      # as 5 equipes e os textos de partida
```

**3. Definir o PIN de edição**

```bash
npm run pin          # atalho para: wrangler secret put ADMIN_PIN
```

Ele pergunta o PIN no terminal. **O PIN não fica em nenhum arquivo do
repositório** — fica guardado como secret na Cloudflare. Se quiser trocar
depois, é só rodar o comando de novo.

**4. Publicar**

```bash
npm run deploy
```

O endereço `https://ministerio-transmissao.<sua-conta>.workers.dev` sai no
terminal. Para usar domínio próprio, é em *Workers & Pages → seu worker →
Settings → Domains & Routes*.

## Rodar na sua máquina

```bash
cp .dev.vars.example .dev.vars      # e edite o PIN de teste lá dentro
npm run db:migrar:local
npm run db:seed:local
npm run dev
```

Abre em `http://localhost:8787`. O banco local é separado do banco de produção.

## Como se usa no dia a dia

1. Clique em **Editar** no topo e digite o PIN. A sessão dura 12 horas.
2. Em **Geral → Nova data**: preencha data, horário, evento e digite os nomes de
   cada função separados por vírgula. Quem já está cadastrado na equipe aparece
   como sugestão clicável.
3. Em **Equipes**: cadastre quem serve em cada função e edite as orientações.
4. Em **Instruções**: os blocos de texto podem ser criados, editados, reordenados
   e apagados.

Os textos aceitam formatação simples: `**negrito**`, `*itálico*`, `- lista`,
`1. numerada`, `## subtítulo`, `> destaque`, `[link](https://...)`.

A página imprime bem (Ctrl+P) — os controles de edição somem e sobra só a escala.

## Segurança — o que está feito

- O PIN nunca vai para o navegador. É trocado por um cookie de sessão assinado
  (HMAC-SHA256), `HttpOnly` + `Secure` + `SameSite=Lax`, com 12h de validade.
- Comparação do PIN em tempo constante.
- 8 tentativas erradas bloqueiam o IP por 15 minutos.
- Escrita vinda de outro site é recusada (checagem de `Origin`).
- Todo texto do usuário é escapado antes de virar HTML; links só `http(s)`.
- Todos os campos têm limite de tamanho e validação no servidor.

Ainda assim: **é um PIN único compartilhado**. Quem tem o PIN pode mudar tudo.
Se ele vazar no grupo do WhatsApp, troque com `npm run pin`.

## Mexer no projeto

```
migrations/     estrutura e conteúdo inicial do banco (SQL)
src/worker.js   API, autenticação e entrega do SPA
public/         o site (index.html + assets/styles.css + assets/app.js)
wrangler.jsonc  configuração da Cloudflare
```

Coisas comuns:

- **Trocar o nome da igreja/ministério**: `public/index.html`, na `.marca` e no `<title>`.
- **Mudar cores**: as variáveis no topo de `public/assets/styles.css` (`:root`).
  Tema claro e escuro seguem o sistema, com botão para forçar um dos dois.
- **Nova função/equipe**: não precisa código — o botão *Nova equipe* dentro de
  **Equipes** cria e ela já entra no menu lateral e na escala.
- **Fuso horário**: o servidor usa `America/Sao_Paulo` para saber o que é
  "hoje". Para mudar, adicione `"vars": { "FUSO": "..." }` no `wrangler.jsonc`.

## Fora do escopo (decidido no início)

- Geração automática de escala
- Múltiplos níveis de usuário / contas individuais
