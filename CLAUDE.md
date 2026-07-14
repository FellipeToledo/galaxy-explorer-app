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
server/translate-core.mjs   # núcleo de tradução (DeepL + cache), compartilhado
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
│   └── mars/               # galeria (Image Library), filtros, autocomplete,
│                           # scroll infinito, lightbox, cards neon
├── shared/
│   ├── starfield/          # fundo de estrelas em <canvas> (fora da zona)
│   ├── navbar/             # navegação + seletor de idioma
│   ├── glass-select/       # dropdown glass reutilizável (teclado, aria)
│   ├── in-view/            # IntersectionObserver → classe .in-view
│   └── scroll-end/         # IntersectionObserver → output scrolled (infinite)
└── app.routes.ts           # rotas lazy: '' = APOD, 'mars' = Marte
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
- **i18n**: solução própria leve. UI via dicionários (`translations.ts`,
  pt-BR default + en-US) + pipe impuro `t`; datas com locale dinâmico
  (`| date: 'longDate' : undefined : translate.lang()`). Conteúdo dinâmico da
  API via pipe `ct` → `ContentTranslateService` com camadas:
  backend `/api/translate` (DeepL, batching+cache) → Translator API do
  navegador → texto original. `DEEPL_API_KEY` já configurada na Vercel.
  **Toda string nova de UI deve entrar nos dois dicionários.**
- **Cards neon** (Marte): borda cônica em arco com cauda transparente girando
  via `@property --border-angle` (global em styles.scss), glow no `::after`
  `inset:-8px blur(16px)`; **gira só com `.in-view`** (perf), acelera no hover.
  **NUNCA usar `content-visibility:auto`** nesses cards (recorta a borda).
- Dropdowns/autocomplete: reutilizar `GlassSelectComponent` e o padrão de
  sugestões do Marte; containers de filtros precisam de `position:relative` +
  `z-index` acima do grid.
- Verificação de layout com alturas uniformes: reservar linhas com
  `-webkit-line-clamp` + `min-height`.

## Próxima feature planejada: ☄️ Asteroides (NeoWs) + gráficos

Escopo acordado (recomendação aceita pelo usuário):

- **API**: NeoWs `GET https://api.nasa.gov/neo/rest/v1/feed?start_date=…&end_date=…&api_key=…`
  (janela máx. 7 dias; usa a chave NASA do environment). Resposta:
  `near_earth_objects: { 'YYYY-MM-DD': NeoObject[] }`; campos úteis:
  `name`, `estimated_diameter.meters.{min,max}`,
  `is_potentially_hazardous_asteroid`,
  `close_approach_data[0].{relative_velocity.kilometers_per_hour,`
  `miss_distance.{kilometers,lunar}, close_approach_date_full}`,
  `absolute_magnitude_h`, `nasa_jpl_url`.
- **UI planejada**: rota `/asteroids` + link no navbar (i18n nos 2 idiomas);
  dashboard com stat tiles (total da semana, perigosos, mais próximo, mais
  rápido), gráfico de dispersão distância×tamanho (destacar perigosos) e/ou
  barras por dia, lista/cards com detalhes, seletor de período (semana).
- **Gráficos**: seguir a skill `dataviz` (carregar antes de codar os charts);
  preferir SVG próprio leve ou canvas sem lib pesada, cores do tema
  (--cyan/--violet/--amber para perigosos), acessível, tooltips.
- Reutilizar: glass-select (períodos), estados loading/erro/vazio padrão,
  pipes `t`/`ct`, tema glass.
- Entregar via PR para main (deploy automático Vercel).

## Backlog / TODOs (levantados na conversa)

Novas seções (após Asteroides):
- [ ] **🌍 EPIC** — imagens de disco completo da Terra (`/EPIC/api/natural`),
      galeria com slider temporal ("Terra flutuando").
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

Infra:
- [ ] **Cache de tradução durável** — hoje é em memória (some em cold start
      do serverless). Avaliar Vercel KV/Redis no `translate-core.mjs`.
- [ ] Confirmar `DEEPL_API_KEY` também no ambiente **Preview** (se quiser que
      previews traduzam) — hoje garantida em Production.

Concluídos (referência): i18n UI (pt-BR/en), tradução de conteúdo (DeepL +
fallback navegador/original), scroll infinito, filtros fiéis (ano+ordenação),
glass-select, autocomplete, cards neon, deploy Vercel + serverless.

## Histórico essencial (para contexto)

MVP: APOD + Marte → API de Marte arquivada → migração p/ Image Library →
cards neon (CodePen ref do usuário, efeito cometa) → perf (in-view) →
alturas uniformes → lightbox fix → scroll infinito → filtros fiéis
(ano + ordenação) → glass-select → autocomplete → z-index fix → i18n UI →
tradução de conteúdo (browser) → backend DeepL → serverless Vercel →
PR #19 mergeado, produção OK (usuário confirmou "tudo perfeito e funcional").
