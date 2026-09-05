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

### Jeito mais rápido — um clique

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/rafaeldosvideos/ministeriotransmissao)

O botão copia o repositório para a sua conta, provisiona o que o projeto
declara, configura o deploy automático a cada push e publica. Depois é só
definir o `ADMIN_PIN` em **Settings → Variables and Secrets** do Worker.

### Pelo terminal


O banco `ministerio-transmissao` (id `8350669b-151b-4751-9131-f6c270e91f2f`)
já está criado e populado, e o id já está no `wrangler.jsonc`.

```bash
npm install
npx wrangler login     # abre o navegador, você autoriza
npm run deploy         # publica
npm run pin            # define o PIN de edição (pergunta no terminal)
```

O endereço `https://ministerio-transmissao.<sua-conta>.workers.dev` sai no
terminal do `deploy`.

### Pelo painel, sem terminal

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** →
   **Create** → **Import a repository** → escolha `ministeriotransmissao`.
2. O nome do Worker precisa ser exatamente **`ministerio-transmissao`**
   (tem que bater com o `name` do `wrangler.jsonc`, senão o build falha).
3. Deploy.
4. No Worker → **Settings** → **Variables and Secrets** → **Add** → tipo
   **Secret**, nome `ADMIN_PIN`, valor = o PIN. Salvar e fazer um novo deploy.

A partir daí, todo push no repositório publica sozinho.

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
