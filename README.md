# 🪐 Galaxy Explorer

App em **Angular 20** com tema de galáxia para explorar os dados abertos da
**NASA** de uma forma elegante e moderna. Fundo de estrelas animado,
glassmorphism e acentos violeta/ciano em um visual de espaço profundo.

## ✨ Funcionalidades (MVP)

- **Foto do Dia (APOD)** — imagem/vídeo astronômico do dia com explicação,
  seletor de data, botão "Surpreenda-me" (data aleatória) e link para HD.
- **Marte (Mars Rover Photos)** — galeria de fotos dos rovers (Perseverance,
  Curiosity, Opportunity, Spirit) com filtro por rover e data, além de
  lightbox para ampliar cada imagem.

## 🔑 Chave da API

O app usa as [APIs abertas da NASA](https://api.nasa.gov/). Obtenha sua chave
gratuita e substitua o valor em `src/environments/environment.ts`
(e `environment.prod.ts` para produção):

```ts
export const environment = {
  production: false,
  nasaApiKey: 'SUA_CHAVE_AQUI', // troque DEMO_KEY pela sua
  nasaApiBase: 'https://api.nasa.gov',
};
```

> `DEMO_KEY` funciona para testes, mas tem limites baixos (30 req/h, 50/dia).
>
> ⚠️ Por ser um app front-end, a chave fica visível no bundle. Para produção,
> considere um proxy/backend que injete a chave server-side.

## 🚀 Como rodar

```bash
npm install
npm start          # dev server em http://localhost:4200
npm run build      # build de produção em dist/
```

## 🧱 Arquitetura

```
src/app/
├── core/
│   ├── models/            # interfaces (APOD, Mars)
│   └── services/          # NasaApiService (HttpClient central)
├── features/
│   ├── apod/              # tela Foto do Dia
│   └── mars/              # galeria de Marte
├── shared/
│   ├── starfield/         # fundo de estrelas em <canvas>
│   └── navbar/            # navegação
└── app.{ts,html,scss}     # shell + rotas
```

Standalone components + signals, rotas com lazy-loading, tema via CSS custom
properties em `src/styles.scss`.

## 🛠️ Próximos passos sugeridos

- **Asteroides (NeoWs)** — dashboard de objetos próximos à Terra com gráficos.
- **EPIC** — imagens de disco completo da Terra.
- **Busca de mídia** — acervo de imagens/vídeos da NASA.
- Filtro por câmera na tela de Marte e paginação/scroll infinito.
