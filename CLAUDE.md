# Galaxy Explorer — Guia do Projeto (para Claude e devs)

App **Angular 20** (standalone components + signals) com tema de galáxia que
apresenta dados das APIs abertas da NASA. Idioma do usuário: **pt-BR** (falar
em português). Em produção na Vercel: https://galaxy-explorer-app.vercel.app

## Comandos

```bash
npm start        # só o front-end (http://localhost:4200)
npm run dev      # front-end + proxy de tradução (recomendado)
npm run server   # só o proxy de tradução (porta 3001)
npm run build    # build de produção (dist/galaxy-explorer/browser)
```

## Fluxo de trabalho (IMPORTANTE)

- Trabalhe numa **branch de trabalho dedicada** (verifique/crie uma branch
  `claude/…`; o nome varia por sessão — **não assuma uma branch fixa**).
  **Nunca** dar push direto na `main` — a produção (Vercel, git-connected)
  deploya da main; entregar via Pull Request para o usuário mergear.
- Commits: mensagens em pt-BR, estilo conventional (`feat(mars): …`), com
  identidade `Claude <noreply@anthropic.com>` (`git config` local já ajustado).
- **A rede deste container bloqueia TODAS as APIs externas** (api.nasa.gov,
  images-api.nasa.gov, DeepL, Google Fonts → 403/connection reset). Para
  verificar features:
  1. `npx ng build` sempre;
  2. semear dados mock **temporários** no `ngOnInit` do componente, subir
     `ng serve` numa porta livre (43xx já usadas: 4200,4210–4226), capturar
     screenshot com playwright-core (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`,
     `--no-sandbox`; instalar com `npm i --no-save playwright-core` — some
     após `npm install`) e **SEMPRE reverter o mock antes de commitar**
     (`grep -c "mock-" …` para conferir);
  3. estados de erro nos screenshots são esperados (rede bloqueada) — validar
     layout/comportamento, não dados reais; ser transparente com o usuário
     sobre o que não pôde ser testado de verdade.
- **Limites do Browser pane** (quando usado no lugar do playwright): a aba fica
  com `document.visibilityState === 'hidden'` → **`IntersectionObserver` nunca
  dispara** e o screenshot expira. Ou seja, `.in-view` (borda girando) e o
  **scroll infinito** não são verificáveis por lá — dá para testar o CSS
  forçando a classe (`classList.add('in-view')` + `getComputedStyle(el,
  '::before').animationName`), mas o resto fica com o usuário. **Não** confundir
  isso com regressão.
- O usuário valida visualmente na máquina dele; screenshots dele orientam
  ajustes finos. Preferências: perguntar antes de mudanças de escopo, oferecer
  recomendação clara ("vai na sua recomendação" = prosseguir).

## Arquitetura

```text
scripts/generate-config.mjs # build: NASA_API_KEY (env) → public/config.json
server/translate-core.mjs   # núcleo de tradução (DeepL + cache), compartilhado
server/kv-cache.mjs         # cache durável opcional (KV via REST, sem deps)
server/index.mjs            # proxy local de dev (Node puro, sem deps)
api/translate.mjs, health.mjs # funções serverless Vercel (usam o núcleo)
vercel.json                 # build + outputDirectory + SPA rewrites (preserva /api)
proxy.conf.json             # dev: /api → localhost:3001
src/app/
├── core/
│   ├── i18n/               # TranslateService (UI), ContentTranslateService
│   │                       # (conteúdo da API), pipes `t` e `ct`, dicionários,
│   │                       # title.strategy.ts (título da aba por idioma)
│   ├── models/             # apod, media (NasaMedia/SortMode), mars (ROVERS),
│   │                       # neo, epic
│   └── services/nasa-api.service.ts  # HttpClient central (chave via environment)
├── features/
│   ├── apod/               # Foto do Dia (imagem/vídeo, data, aleatório)
│   ├── mars/               # galeria (Image Library): rovers + busca contextual
│   ├── media/              # 🎨 busca livre no acervo (imagens + vídeos)
│   ├── asteroids/          # dashboard NeoWs: stat tiles + 2 gráficos + tabela
│   │   └── charts/         # neo-bars, neo-scatter (SVG próprio) + charts.scss
│   └── earth/              # EPIC: disco da Terra + slider temporal (play/pause)
├── shared/
│   ├── starfield/          # fundo de estrelas em <canvas> (fora da zona)
│   ├── navbar/             # navegação + seletor de idioma
│   ├── translating/        # chip "traduzindo…" (global, lê o ContentTranslate)
│   ├── media-card/         # card neon (Marte + Mídia) — CSS mora aqui
│   ├── media-lightbox/     # lightbox de imagem/vídeo + assets sob demanda
│   ├── glass-select/       # dropdown glass reutilizável (teclado, aria)
│   ├── in-view/            # IntersectionObserver → classe .in-view
│   └── scroll-end/         # IntersectionObserver → output scrolled (infinite)
└── app.routes.ts           # rotas lazy: '' = APOD, 'mars', 'asteroids',
                            # 'earth', 'media' (title = CHAVE i18n)
```

## Decisões técnicas (não re-litigar)

- **Mars Rover Photos API foi ARQUIVADA pela NASA (2025)** → a seção Marte usa
  a **NASA Image and Video Library** (`images-api.nasa.gov`, sem chave).
  Filtros fiéis: `year_start/year_end` (a API **não tem sort** → ordenação por
  data é client-side via computed `sortedImages`; página = 100 itens).
- **Chave NASA / config runtime**: lida via `AppConfigService` (carregado no
  boot por `APP_INITIALIZER`), com padrões do `environment` sobrescritos por
  `public/config.json` (**gitignored**; ex.: `public/config.example.json`).
  A chave do dev vai no `config.json` — **NUNCA editar `environment.ts` nem
  commitar chaves**. Serviços leem de `AppConfigService`, não do environment.
  **Em produção o `config.json` é gerado no build** por
  `scripts/generate-config.mjs` (`npm run build`) a partir da env var
  `NASA_API_KEY` da Vercel. Sem isso a produção caía em `DEMO_KEY` → **429**
  em APOD/Asteroides/Terra, e **só Marte funcionava** (Image Library não exige
  chave) — se o sintoma voltar, **é a env var**, não o código. Regras do script:
  sem `NASA_API_KEY` ele **não toca** num `config.json` existente (não destrói o
  do dev); com a env var, **o ambiente vence** o conteúdo do arquivo (senão um
  `DEMO_KEY` velho recriaria o bug); nunca loga a chave (log de build é visível).
- **i18n**: solução própria leve. UI via dicionários (`translations.ts`,
  pt-BR default + en-US) + pipe impuro `t`; datas com locale dinâmico
  (`| date: 'longDate' : undefined : translate.lang()`). Conteúdo dinâmico da
  API via pipe `ct` → `ContentTranslateService` com camadas:
  backend `/api/translate` (DeepL, batching+cache) → Translator API do
  navegador → texto original. `DEEPL_API_KEY` já configurada na Vercel.
  **Toda string nova de UI deve entrar nos dois dicionários.**
- **DeepL Free x Pro**: são **hosts diferentes** — chave terminada em `:fx` é
  Free (`api-free.deepl.com`); sem `:fx` é Pro (`api.deepl.com`). Host errado →
  **403**, que se disfarça de "chave inválida". `deeplEndpoint()` escolhe pelo
  formato da chave; `DEEPL_API_URL` força manualmente (aí `urlOverridden`).
- **Quota do DeepL free = 500k chars/mês — e ela ESTOUROU uma vez.** Medido com
  dados reais: 1 página do Marte (100 cards) = **65.676 chars** (descrição média
  615), ou seja **7,6 páginas/mês**. Duas defesas, não re-litigar:
  1. `| ct: 160` nos textos que a UI já corta (card do Marte tem
     `line-clamp: 2`): manda só o visível → 19.812 chars/página (**−70%**).
     O lightbox usa `| ct` sem limite (traduz completo, sob demanda). O corte é
     na fronteira de palavra (`clip()`), senão a tradução sai ruim.
     **Regra: texto com `line-clamp`/truncado na UI → sempre `ct` com limite.**
  2. Cache **KV** (L2): sem ele, todo cold start re-traduz tudo do zero.
  Sintoma de quota estourada: `/api/translate` → 502 com `upstream: 456`.
- **Diagnóstico da tradução**: `/api/health` mostra `provider`, `cache` e o bloco
  `deepl` (`keyKind`, `host`, `endpointMatchesKey`, **sem expor a chave**).
  **Env var presente ≠ funcionando** — essa confusão já custou duas sessões de
  debug, então os checks batem no serviço de verdade:
  `?check=deepl` traduz uma palavra, `?check=kv` grava e lê uma chave no cache,
  `?check=all` faz os dois. `cache: memory+kv` só prova que as **env vars
  existem**; quem prova o KV é o `kvCheck`. Erros do `/api/translate` trazem
  `upstream` (status do DeepL) e `detail`: **403** chave/host, **456** quota do
  mês, **429** taxa. Se pedirem para depurar tradução, **comece por aqui**.
- **Cache de tradução em 2 camadas**: L1 memória + L2 KV durável
  (`server/kv-cache.mjs`). O KV é **opcional** — ligado só quando existem
  `KV_REST_API_URL`+`KV_REST_API_TOKEN` (ou o par `UPSTASH_REDIS_REST_*`);
  sem eles, comportamento antigo (só memória). Falamos com o KV pela **REST API
  via `fetch`**, sem `@vercel/kv` — `server/` continua sem dependências.
  Regras: o cache **nunca derruba a tradução** (erro do KV → aviso + segue para
  o DeepL, com timeout de 3s); chave é `tr:<target>:<sha256(texto)[0..32]>`
  (texto inteiro na chave vazaria conteúdo e estouraria o tamanho); TTL 30 dias;
  **`identity` não grava** (encheria o KV com o texto original). `/api/health`
  expõe `cache: memory | memory+kv`.
- **Marte x 🎨 Mídia — não confundir**: o **Marte** é curadoria marciana (chips
  de rover + busca *dentro* do contexto Marte); a **Mídia** é busca livre no
  acervo inteiro, com imagens **e vídeos**. A busca do Marte **fica onde está**
  (decisão do usuário). O que é compartilhado são os componentes:
  `shared/media-card` e `shared/media-lightbox` — **o CSS do card neon mora no
  media-card**, não duplicar no feature. Item = `NasaMedia` (`media.model.ts`).
- **Anos do filtro da Mídia — medidos, não chutados**: varredura ano a ano no
  acervo (`year_start=year_end`, termo genérico) → **`FIRST_YEAR = 1938`**, o
  primeiro ano a partir do qual **nenhum ano fica vazio**. Antes dele há 25 anos
  sem nada (1901–1937, com furos) e só curiosidades soltas (1 item em 1900, 1 em
  1903, 1 em 1912). O valor antigo (1958, "Explorer 1") era palpite e **escondia
  conteúdo real** — 1938–1957 têm de 3 a 90 itens por ano. O teto é o **ano
  atual**: a API tem itens datados em 2027 e até 2030 ("Artemis II Water Deluge
  Test"), mas são metadados errados. **Se for mexer no range, meça de novo** —
  não chute.
- **Datas do acervo são UTC** → `| date: … : 'UTC'` nos cards/lightbox. Em fuso
  local, `1938-01-01T00:00Z` vira "31/12/1937" e o card mostra um ano diferente
  do filtro selecionado (o Brasil é UTC−3). Mesmo motivo do EPIC.
- **Anos vazios por termo são NORMAIS, não bug**: o filtro de ano é global e os
  resultados dependem da busca — Perseverance não tem 2004–2016 (o rover nem
  existia) e Opportunity não tem 2025–2026 (missão encerrada). Não tentar
  "consertar" isso; a API não tem facets para anos por termo.
- **Vídeos** (`media_type=video`): o link `render=image` do item é o frame de
  capa. Os arquivos vêm do `collection.json`: **`~orig.mp4` = 1,4 GB**,
  `~small` = 532 MB, **`~mobile` = 118 MB** (o menor → é o que tocamos).
  **SEMPRE `preload="none"` + `poster`**: o `<video>` faz streaming por range,
  então nada é baixado até o play — verificado (`buffered.length === 0`).
  Legendas `.vtt` entram como `<track kind="captions">` quando existem.
- **Cards neon** (`shared/media-card`): borda cônica em arco com cauda girando
  via `@property --border-angle` (global em styles.scss), glow no `::after`
  `inset:-8px blur(16px)`; **gira só com `.in-view`** (perf), acelera no hover.
  **NUNCA usar `content-visibility:auto`** nesses cards (recorta a borda).
- Dropdowns/autocomplete: reutilizar `GlassSelectComponent` e o padrão de
  sugestões do Marte; containers de filtros precisam de `position:relative` +
  `z-index` acima do grid.
- **NUNCA escrever em signal durante o render** (`NG0600`): o pipe `ct` chama
  `ContentTranslateService.translate()` **dentro da renderização**, então
  qualquer `signal.set/update` no caminho dele quebra a detecção de mudanças —
  a tela sai pela metade (foi assim que o lightbox ficou sem `src`). O contador
  do indicador usa `bump()` com `queueMicrotask`. Vale para qualquer estado
  novo que o `ct` venha a tocar.
- **Assets da Image Library** (`collection.json`, via `href` do item da busca —
  não montar URL na mão): **nem todo item tem todos os tamanhos** — os antigos
  (`PIA*`) só têm `~orig` e `~thumb`. Daí a cadeia
  `large → medium → small → orig` em `getImageAssets()`. `~large` ≈ 280 KB é o
  alvo; **`~orig` passa de 10 MB** e por isso é só link ("ver original"), nunca
  exibido — mesmo padrão do PNG no EPIC. O manifest devolve URLs em **http://**
  → `forceHttps()`, senão é mixed content bloqueado em produção. Buscado **sob
  demanda** no lightbox: são 100 itens por página.
- Verificação de layout com alturas uniformes: reservar linhas com
  `-webkit-line-clamp` + `min-height`.
- **Asteroides (NeoWs)**: `GET {base}/neo/rest/v1/feed?start_date&end_date`
  (chave NASA; **janela máx. 7 dias**). O feed agrupa por data e **repete todas
  as aproximações de cada objeto** → o serviço casa a aproximação com o dia do
  grupo e achata tudo em `Neo[]`. Datas montadas em fuso **local**
  (`toISOString()` usaria UTC e pularia um dia).
- **Terra (EPIC)**: `/EPIC/api/natural[/date/YYYY-MM-DD]` + `/available` (datas).
  **As imagens do arquivo também exigem a chave** e a URL é derivada da data:
  `/EPIC/archive/natural/YYYY/MM/DD/{png|jpg}/<image>.{png|jpg}?api_key=…`.
  Exibimos o **JPG** (2048²) e o PNG vira link "alta resolução" — animar ~20
  PNGs de ~2 MB não é viável. `date` vem como `"YYYY-MM-DD HH:mm:ss"` (UTC, e
  **não é ISO válido** em todo navegador) → o serviço também entrega `dateIso`.
  Os quadros são pré-carregados antes do play (senão o 1º ciclo pisca), e a
  flutuação CSS **para durante o play** (dois movimentos somados enjoam).
- **Gráficos (skill `dataviz`)**: SVG próprio, sem lib. As cores das marcas
  (`charts.scss`: `--mark-safe #0891b2`, `--mark-hazard #d97706`) foram
  **validadas** por `scripts/validate_palette.js` do skill contra a superfície
  `#0d0726` — **não trocar por `--cyan`/`--amber`**, que reprovam a banda de
  luminosidade do modo escuro (são claros demais). `--cyan`/`--amber` seguem
  valendo para chrome/texto. Regras seguidas (não re-litigar): eixo único,
  legenda sempre presente + ícone ⚠ (identidade nunca só pela cor), rótulo
  direto só no pico **quando ele é único**, vão de 2px entre segmentos, anel de
  2px nos pontos, grade hairline sólida, tabela como leitura acessível (nenhum
  valor preso no tooltip), dispersão com camada de **ponto-mais-próximo**
  (mirar pontos de 9px é inviável, ainda mais com o SVG encolhendo no mobile).

## Backlog / TODOs (levantados na conversa)

Melhorias no que já existe:
- [ ] **Filtro por câmera** no Marte (estava no plano inicial da API antiga;
      reavaliar viabilidade com a Image Library).
- [ ] **Nomes de asteroide no `ct`?** — hoje `name` e datas do NeoWs não passam
      pela tradução de conteúdo (são designações, não prosa). Reavaliar só se
      aparecer texto livre na seção.
- [ ] **Períodos além de 7 dias** nos Asteroides — exigiria encadear chamadas ao
      feed (limite da API) ou usar `/neo/browse`; hoje o seletor tem
      hoje / próximos 7 / últimos 7. (Pedido explícito do usuário para ficar no
      backlog, não implementar agora.)
- [ ] **Datas do EPIC além das 60 mais recentes** — o `/available` traz milhares
      de datas e o seletor corta em 60 (`MAX_DATES`). Avaliar um date picker
      com as datas válidas em vez da lista.
- [ ] **Vídeo/GIF do dia no EPIC** — exportar a sequência animada do dia.

Infra:
- [ ] **Esperar o reset da quota do DeepL** (estourou; ver a data do ciclo no
      painel da DeepL). Até lá o app cai no fallback (texto original) — é o
      comportamento correto, não é bug. Depois, conferir com
      `/api/health?check=all` que `check.ok` virou `true`.
- [ ] **Vercel: provisionar KV foi feito com o `Upstash for Redis`** — se algum
      dia precisar refazer, **não** use o provider "Redis" (redis.io) do
      marketplace: ele injeta só `REDIS_URL` (TCP `redis://`), e o
      `kv-cache.mjs` fala **REST/HTTP**. Sinal de acerto: aparecem
      `KV_REST_API_URL`/`KV_REST_API_TOKEN`. Env var nova **exige redeploy**.

Concluídos (referência): i18n UI (pt-BR/en), tradução de conteúdo (DeepL +
fallback navegador/original), scroll infinito, filtros fiéis (ano+ordenação),
glass-select, autocomplete, cards neon, deploy Vercel + serverless,
**infra de produção**: `NASA_API_KEY` e `DEEPL_API_KEY` definidas na Vercel
(Production + Preview) e **KV provisionado** (Upstash, `cache: memory+kv`),
**☄️ Asteroides (NeoWs)**: rota `/asteroids`, seletor de período, stat tiles
(total/perigosos/mais próximo/mais rápido), colunas empilhadas por dia,
dispersão distância×tamanho e tabela — tudo i18n nos 2 idiomas.
**🌍 Terra (EPIC)**: rota `/earth`, seletor de data, disco em JPG com halo,
slider temporal com play/pause/anterior/próximo e pré-carregamento dos quadros.
**Melhorias**: `AppTitleStrategy` (título da aba segue o idioma — as rotas
guardam a **chave**, não o texto), indicador "traduzindo…"
(`shared/translating/`), alta resolução no lightbox via `collection.json` e
autocomplete dinâmico no Marte (debounce 320ms, mín. 3 chars, `switchMap`
cancelando o anterior; curadas como fallback).
**🎨 Busca de mídia**: rota `/media`, busca livre no acervo com filtros de
tipo (tudo/imagens/vídeos), ano e ordenação, player de vídeo com legendas;
cards e lightbox extraídos para `shared/` e reusados pelo Marte.

## Histórico essencial (para contexto)

MVP: APOD + Marte → API de Marte arquivada → migração p/ Image Library →
cards neon (CodePen ref do usuário, efeito cometa) → perf (in-view) →
alturas uniformes → lightbox fix → scroll infinito → filtros fiéis
(ano + ordenação) → glass-select → autocomplete → z-index fix → i18n UI →
tradução de conteúdo (browser) → backend DeepL → serverless Vercel →
PR #19 mergeado, produção OK (usuário confirmou "tudo perfeito e funcional") →
chave NASA em `config.json` de runtime (PR #21) → seção Asteroides (NeoWs) com
gráficos SVG próprios seguindo a skill `dataviz` (PR #23) → seção Terra (EPIC)
com slider temporal.
