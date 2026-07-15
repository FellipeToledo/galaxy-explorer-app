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
│   │                       # (conteúdo da API), pipes `t` e `ct`, dicionários
│   ├── models/             # apod.model.ts, mars.model.ts (+ SortMode etc.)
│   └── services/nasa-api.service.ts  # HttpClient central (chave via environment)
├── features/
│   ├── apod/               # Foto do Dia (imagem/vídeo, data, aleatório)
│   ├── mars/               # galeria (Image Library), filtros, autocomplete,
│   │                       # scroll infinito, lightbox, cards neon
│   ├── asteroids/          # dashboard NeoWs: stat tiles + 2 gráficos + tabela
│   │   └── charts/         # neo-bars, neo-scatter (SVG próprio) + charts.scss
│   └── earth/              # EPIC: disco da Terra + slider temporal (play/pause)
├── shared/
│   ├── starfield/          # fundo de estrelas em <canvas> (fora da zona)
│   ├── navbar/             # navegação + seletor de idioma
│   ├── glass-select/       # dropdown glass reutilizável (teclado, aria)
│   ├── in-view/            # IntersectionObserver → classe .in-view
│   └── scroll-end/         # IntersectionObserver → output scrolled (infinite)
└── app.routes.ts           # rotas lazy: '' = APOD, 'mars' = Marte,
                            # 'asteroids' = Asteroides, 'earth' = Terra
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
- **Cards neon** (Marte): borda cônica em arco com cauda transparente girando
  via `@property --border-angle` (global em styles.scss), glow no `::after`
  `inset:-8px blur(16px)`; **gira só com `.in-view`** (perf), acelera no hover.
  **NUNCA usar `content-visibility:auto`** nesses cards (recorta a borda).
- Dropdowns/autocomplete: reutilizar `GlassSelectComponent` e o padrão de
  sugestões do Marte; containers de filtros precisam de `position:relative` +
  `z-index` acima do grid.
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

Novas seções:
- [ ] **🎨 Busca de mídia** — extrair a busca livre do Marte para uma seção
      própria (reusar cards + autocomplete + scroll infinito).

Melhorias no que já existe:
- [ ] **Título da aba (rota) i18n** — hoje fixo em pt-BR; criar um
      `TitleStrategy` que troca com o idioma.
- [ ] **Autocomplete dinâmico** — sugestões vindas da API em tempo real
      (com debounce) em vez da lista curada atual.
- [ ] **Alta resolução** no lightbox — usar o asset manifest da Image Library
      (`collection.json`) para a imagem full-res; hoje usa o thumbnail.
- [ ] **Filtro por câmera** no Marte (estava no plano inicial da API antiga;
      reavaliar viabilidade com a Image Library).
- [ ] **Indicador "traduzindo…"** enquanto o DeepL/pacote processa o conteúdo.
- [ ] **Vídeos** (media_type=video) na busca de mídia.
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
- [ ] **Provisionar o KV na Vercel** — o código do cache durável já está pronto
      e desligado por padrão. Criar um Vercel KV/Upstash e conectá-lo ao projeto
      injeta `KV_REST_API_URL`/`KV_REST_API_TOKEN` sozinho; conferir depois em
      `/api/health` que `cache` virou `memory+kv`. **Só o usuário pode fazer
      isso** (conta da Vercel).
- [ ] Marcar `DEEPL_API_KEY` também no ambiente **Preview** (hoje só garantida
      em Production; sem ela os previews caem no texto original). Documentado no
      README — **ação do usuário** no painel da Vercel.
- [ ] **Definir `NASA_API_KEY` na Vercel** (Production **e** Preview) e redeploy.
      O código já está pronto; **sem isso a produção segue em DEMO_KEY → 429**
      em APOD/Asteroides/Terra. Precisa de uma chave gratuita de
      https://api.nasa.gov/ — **só o usuário pode criar**. Conferir depois que
      `/config.json` do site publicado não traz `DEMO_KEY`.

Concluídos (referência): i18n UI (pt-BR/en), tradução de conteúdo (DeepL +
fallback navegador/original), scroll infinito, filtros fiéis (ano+ordenação),
glass-select, autocomplete, cards neon, deploy Vercel + serverless,
**☄️ Asteroides (NeoWs)**: rota `/asteroids`, seletor de período, stat tiles
(total/perigosos/mais próximo/mais rápido), colunas empilhadas por dia,
dispersão distância×tamanho e tabela — tudo i18n nos 2 idiomas.
**🌍 Terra (EPIC)**: rota `/earth`, seletor de data, disco em JPG com halo,
slider temporal com play/pause/anterior/próximo e pré-carregamento dos quadros.

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
