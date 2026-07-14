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

### Produção (Vercel) com sua chave

Não versionamos a chave, então em produção ela vem de uma **env var** e o
build gera o `config.json`:

1. Na Vercel → **Settings → Environment Variables** → adicione
   **`NASA_API_KEY`** (Production e/ou Preview) com a sua chave.
2. Deploy. O script `prebuild` (`scripts/generate-config.mjs`) gera
   `public/config.json` a partir da env var; o `ng build` o inclui no output.

> A chave da NASA é usada no navegador, então continua visível no bundle de
> produção (inerente a APIs client-side) — isso só faz produção usar **sua**
> chave (limites maiores) sem colocá-la no git.

> `DEMO_KEY` funciona para testes, mas tem limites baixos (30 req/h, 50/dia).
> Chave gratuita em https://api.nasa.gov/.
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
- Trocar de provedor (Google/LibreTranslate) = ajustar apenas
  `server/translate-core.mjs` (compartilhado por dev e serverless).

### Deploy na Vercel (serverless)

O mesmo proxy roda como **função serverless** em `api/translate.mjs` (e
`api/health.mjs`), reaproveitando `server/translate-core.mjs`. O `vercel.json`
já configura o build do Angular, o diretório de saída e o SPA fallback.

1. Importe o repositório na Vercel (framework: Other; o `vercel.json` cuida do resto).
2. Em **Settings → Environment Variables**, adicione `DEEPL_API_KEY`.
3. Deploy. O front-end chama `/api/translate` (mesma origem) → função → DeepL.

> O `server/` (Node local) e o `api/` (Vercel) compartilham a lógica, então
> não há duplicação.

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
