# 🪐 Galaxy Explorer

App em **Angular 20** com tema de galáxia para explorar os dados abertos da
**NASA** de uma forma elegante e moderna. Fundo de estrelas animado,
glassmorphism e acentos violeta/ciano em um visual de espaço profundo.

## ✨ Funcionalidades (MVP)

- **Foto do Dia (APOD)** — imagem/vídeo astronômico do dia com explicação,
  seletor de data, botão "Surpreenda-me" (data aleatória) e link para HD.
- **Marte** — galeria de imagens dos rovers e missões em Marte, com chips por
  rover (Perseverance, Curiosity, Opportunity, Spirit), busca livre e lightbox.
  Usa a **NASA Image and Video Library** (`images-api.nasa.gov`), pois a antiga
  **Mars Rover Photos API foi arquivada pela NASA em 2025**. Essa biblioteca é
  aberta e não exige chave.

## 🔑 Chave da API

O app usa as [APIs abertas da NASA](https://api.nasa.gov/). Sua chave fica num
arquivo local **não versionado** (`public/config.json`) — assim ela **nunca
conflita no `git pull`** nem corre risco de ser commitada. **Não edite**
`environment.ts` para colocar a chave.

```bash
cp public/config.example.json public/config.json
# edite public/config.json e coloque sua chave:
#   { "nasaApiKey": "SUA_CHAVE" }
```

O `AppConfigService` carrega esse `config.json` no boot (via `APP_INITIALIZER`)
e sobrescreve os padrões do `environment`. Sem o arquivo, usa `DEMO_KEY`.

**Em produção**, como o arquivo não é versionado, ele é gerado no build a partir
da env var `NASA_API_KEY` (veja [Deploy na Vercel](#deploy-na-vercel-serverless)).

> `DEMO_KEY` **não serve para uso real**: são 30 requisições/hora **por IP**,
> compartilhadas com todo mundo que usa o mesmo padrão — na prática ela vive
> estourada e a API responde `429 OVER_RATE_LIMIT`. Como só Marte dispensa
> chave, é o sintoma clássico de "só Marte funciona".
> Chave gratuita (e instantânea) em https://api.nasa.gov/.
>
> ⚠️ Sendo front-end, a chave fica visível no bundle — o `config.json` evita
> conflitos/commit acidental, mas não a torna secreta no cliente. Para
> esconder de verdade, seria preciso um proxy server-side (como o de tradução).

## 🚀 Como rodar

```bash
npm install
npm start          # só o front-end (http://localhost:4200)
npm run build      # build de produção em dist/
npm run dev        # front-end + proxy de tradução juntos (recomendado)
```

## 🌍 Idiomas e tradução

- UI multi-idioma (**pt-BR** padrão + **English**), com troca em tempo real
  pelo seletor no navbar (persiste em `localStorage`).
- O **conteúdo da NASA** (títulos/descrições) é traduzido sob demanda, com
  cache, em camadas:
  1. **Backend proxy → DeepL** (recomendado, funciona em qualquer navegador);
  2. fallback para a **Translator API on-device** do navegador (Chromium);
  3. fallback para o **texto original**.

### Proxy de tradução (backend + chave)

O proxy fica em `server/index.mjs` (Node puro, sem dependências) e esconde a
chave server-side.

```bash
cp .env.example .env
# edite .env e preencha DEEPL_API_KEY (free tier: https://www.deepl.com/pro-api)
npm run dev        # sobe o Angular (com proxy /api) + o servidor de tradução
```

- Sem chave, o proxy devolve o texto original (o app continua funcionando).
- Para testar o fluxo sem chave: `TRANSLATE_MOCK=1 npm run server`.
- **Quota (free = 500k chars/mês)**: o pipe aceita um limite — `{{ texto | ct: 160 }}`
  manda só os primeiros 160 caracteres. Use nos textos que a UI já corta (os
  cards do Marte têm `line-clamp: 2`): traduzir os ~615 chars completos de cada
  descrição gastava a quota com texto que ninguém vê — 1 página do Marte custava
  65k chars, e o mês inteiro cabia em 7,6 páginas. O lightbox usa `| ct` sem
  limite e traduz o texto completo, sob demanda.
  Quota estourada = `502` com `"upstream": 456`.
- **Free x Pro**: a DeepL tem dois hosts. Chaves da conta Free terminam em
  `:fx` e falam com `api-free.deepl.com`; as Pro, com `api.deepl.com`. O host é
  escolhido pelo formato da chave — host errado devolve **403**, que parece
  "chave inválida" e engana. `DEEPL_API_URL` força um endpoint, se preciso.

#### Diagnosticar a tradução

`/api/health` diz se a env var existe; `?check=deepl` **bate na API de verdade**
e devolve o status — é a diferença entre "a chave está configurada" e "a chave
funciona":

```bash
curl "https://<seu-app>.vercel.app/api/health?check=all"
# { "provider":"deepl", "cache":"memory+kv",
#   "deepl":{"keyKind":"free","host":"api-free.deepl.com","endpointMatchesKey":true},
#   "check":{"ok":true,"status":200,"sample":"ping"},
#   "kvCheck":{"ok":true,"status":200,"roundTrip":"escreveu e leu de volta"} }
```

- `?check=deepl` traduz uma palavra de verdade. Se `check.ok` for `false`, o
  `status` diz o que houve: **403** = chave inválida ou host trocado (confira
  `endpointMatchesKey`); **456** = quota do mês estourada; **429** = taxa.
- `?check=kv` escreve e lê uma chave no cache durável. Repare que
  `cache: "memory+kv"` só prova que as **env vars existem** — quem prova que o
  Upstash responde é o `kvCheck`. Isso importa porque o cache falha em silêncio
  de propósito (nunca derrubar a tradução), então um KV quebrado passaria
  despercebido, gastando quota à toa.
- `?check=all` roda os dois.

O `POST /api/translate` também devolve `upstream` e `detail` quando falha.
- Trocar de provedor (Google/LibreTranslate) = ajustar apenas
  `server/translate-core.mjs` (compartilhado por dev e serverless).

### Deploy na Vercel (serverless)

O mesmo proxy roda como **função serverless** em `api/translate.mjs` (e
`api/health.mjs`), reaproveitando `server/translate-core.mjs`. O `vercel.json`
já configura o build do Angular, o diretório de saída e o SPA fallback.

1. Importe o repositório na Vercel (framework: Other; o `vercel.json` cuida do resto).
2. Em **Settings → Environment Variables**, adicione:
   - **`NASA_API_KEY`** — obrigatória. Sem ela, o build cai no `DEMO_KEY`
     (30 requisições/hora **por IP**, compartilhado com o mundo todo), e APOD,
     Asteroides e Terra respondem **HTTP 429** em produção. Só Marte escapa,
     porque a Image Library não exige chave. Pegue a sua (grátis, na hora) em
     https://api.nasa.gov/.
   - **`DEEPL_API_KEY`** — tradução de conteúdo.

   Marque as duas também no ambiente **Preview**, senão os previews de PR ficam
   sem chave (429 na NASA e texto original em vez de tradução).
3. Deploy. O front-end chama `/api/translate` (mesma origem) → função → DeepL.

> **Como a chave da NASA chega no cliente:** `public/config.json` é gitignored,
> então não existe no repositório. No build, `scripts/generate-config.mjs`
> (rodado pelo `npm run build`) gera o arquivo a partir de `NASA_API_KEY`. Sem a
> env var, o script **não toca** num `config.json` existente — o seu local
> continua intacto quando você builda na sua máquina.

> O `server/` (Node local) e o `api/` (Vercel) compartilham a lógica, então
> não há duplicação.

### Cache de tradução durável (opcional)

O cache tem duas camadas: **memória** (rápida, mas some no cold start de cada
instância serverless) e **KV** (durável). Sem KV configurado só a memória vale
— tudo funciona igual, apenas se paga DeepL de novo depois de cada cold start.

Para ligar o KV: em **Storage → Create Database**, escolha o **Upstash for
Redis** e conecte-o ao projeto — isso injeta `KV_REST_API_URL` e
`KV_REST_API_TOKEN` automaticamente. Não é preciso instalar nada: falamos com o
KV pela REST API via `fetch`, mantendo `server/` sem dependências.

> ⚠️ **Não use o provider "Redis" (redis.io) do marketplace**: ele injeta apenas
> `REDIS_URL` (`redis://`, TCP), e este código fala **REST/HTTP** — o cache
> ficaria desligado silenciosamente. O sinal de que deu certo é aparecerem as
> variáveis `KV_REST_API_*`. Conexão TCP persistente também não combina com
> serverless; o REST do Upstash existe justamente para esse caso.
>
> **Env var nova só vale depois de um redeploy** — o deploy atual não a enxerga.

Confira em `GET /api/health` — o campo `cache` mostra `memory` ou `memory+kv`:

```bash
curl https://<seu-app>.vercel.app/api/health
# {"ok":true,"provider":"deepl","cached":0,"cache":"memory+kv"}
```

> Se o KV estiver fora do ar ou mal configurado, a tradução **não quebra**: o
> núcleo avisa no log e segue direto para o DeepL.

## 🧱 Arquitetura

```
server/index.mjs           # proxy de tradução (DeepL) — chave server-side
src/app/
├── core/
│   ├── i18n/              # TranslateService, pipes t/ct, dicionários
│   ├── models/            # interfaces (APOD, Mars)
│   └── services/          # NasaApiService (HttpClient central)
├── features/
│   ├── apod/              # tela Foto do Dia
│   └── mars/              # galeria de Marte
├── shared/
│   ├── starfield/         # fundo de estrelas em <canvas>
│   ├── navbar/            # navegação + seletor de idioma
│   ├── glass-select/      # dropdown "glass" reutilizável
│   ├── in-view/ scroll-end/ # diretivas (IntersectionObserver)
└── app.{ts,html,scss}     # shell + rotas
```

Standalone components + signals, rotas com lazy-loading, tema via CSS custom
properties em `src/styles.scss`.

## 🛠️ Próximos passos sugeridos

- **Asteroides (NeoWs)** — dashboard de objetos próximos à Terra com gráficos.
- **EPIC** — imagens de disco completo da Terra.
- **Busca de mídia** — expandir a busca da biblioteca para uma seção própria.
- Vídeos e imagens em alta resolução (asset manifest da biblioteca).
- Paginação / scroll infinito na galeria.
