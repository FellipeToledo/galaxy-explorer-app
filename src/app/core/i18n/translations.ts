export type Lang = 'pt-BR' | 'en-US';

/** Idiomas disponíveis (o primeiro é o padrão). */
export const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: 'pt-BR', label: 'Português', flag: '🇧🇷' },
  { code: 'en-US', label: 'English', flag: '🇺🇸' },
];

export const DEFAULT_LANG: Lang = 'pt-BR';

/** Dicionários de tradução (chaves em ponto). Use {{param}} para interpolar. */
export const TRANSLATIONS: Record<Lang, Record<string, string>> = {
  'pt-BR': {
    // Navbar
    'nav.apod': 'Foto do Dia',
    'nav.mars': 'Marte',
    'nav.brandAria': 'Galaxy Explorer — início',
    'nav.language': 'Idioma',

    // Rodapé
    'footer.data': 'Dados fornecidos pelas',
    'footer.apis': 'APIs abertas da NASA',
    'footer.made': 'Feito com Angular ✦',

    // Comum
    'common.retry': 'Tentar novamente',

    // APOD
    'apod.eyebrow': 'NASA · Foto Astronômica do Dia',
    'apod.title1': 'A Foto',
    'apod.title2': 'do Cosmos',
    'apod.date': 'Data',
    'apod.surprise': '🎲 Surpreenda-me',
    'apod.surpriseTitle': 'Ir para uma data aleatória',
    'apod.loading': 'Percorrendo o universo…',
    'apod.error':
      'Não foi possível carregar a imagem. Verifique sua chave da API ou o limite de requisições.',
    'apod.hd': 'Ver em HD ↗',

    // Marte
    'mars.eyebrow': 'NASA · Biblioteca de Imagens e Vídeos',
    'mars.title1': 'Poeira',
    'mars.title2': 'Vermelha',
    'mars.subtitle': 'Imagens dos rovers e das missões da NASA em Marte.',
    'mars.searchPlaceholder': 'Buscar (ex.: crater, dunes…)',
    'mars.searchAria': 'Buscar imagens',
    'mars.year': 'Ano',
    'mars.allYears': 'Todos os anos',
    'mars.sort': 'Ordenar',
    'mars.filterYearAria': 'Filtrar por ano',
    'mars.sortAria': 'Ordenar imagens',
    'mars.loading': 'Recebendo transmissão de Marte…',
    'mars.error':
      'Não foi possível carregar as imagens. Verifique sua conexão e tente novamente.',
    'mars.empty': '🛰️ Nenhuma imagem encontrada.',
    'mars.emptyHint': 'Tente outro rover, outro ano ou outro termo de busca.',
    'mars.count': '{{count}} imagem(ns)',
    'mars.loadMore': 'Carregar mais',
    'mars.end': '✦ Fim dos resultados ✦',
    'mars.cardBrand': 'Marte',
    'mars.cardFallbackDesc': 'Imagem do acervo da NASA.',
    'mars.viewImage': 'Ver imagem →',
    'mars.close': 'Fechar',

    // Ordenação
    'sort.relevance': 'Relevância',
    'sort.newest': 'Mais recentes',
    'sort.oldest': 'Mais antigas',
  },
  'en-US': {
    // Navbar
    'nav.apod': 'Picture of the Day',
    'nav.mars': 'Mars',
    'nav.brandAria': 'Galaxy Explorer — home',
    'nav.language': 'Language',

    // Footer
    'footer.data': 'Data provided by the',
    'footer.apis': 'NASA open APIs',
    'footer.made': 'Made with Angular ✦',

    // Common
    'common.retry': 'Try again',

    // APOD
    'apod.eyebrow': 'NASA · Astronomy Picture of the Day',
    'apod.title1': 'The Cosmic',
    'apod.title2': 'Snapshot',
    'apod.date': 'Date',
    'apod.surprise': '🎲 Surprise me',
    'apod.surpriseTitle': 'Go to a random date',
    'apod.loading': 'Traversing the universe…',
    'apod.error':
      'Could not load the image. Check your API key or the request limit.',
    'apod.hd': 'View in HD ↗',

    // Mars
    'mars.eyebrow': 'NASA · Image and Video Library',
    'mars.title1': 'Red',
    'mars.title2': 'Dust',
    'mars.subtitle': "Images from NASA's rovers and missions on Mars.",
    'mars.searchPlaceholder': 'Search (e.g., crater, dunes…)',
    'mars.searchAria': 'Search images',
    'mars.year': 'Year',
    'mars.allYears': 'All years',
    'mars.sort': 'Sort',
    'mars.filterYearAria': 'Filter by year',
    'mars.sortAria': 'Sort images',
    'mars.loading': 'Receiving transmission from Mars…',
    'mars.error':
      'Could not load the images. Check your connection and try again.',
    'mars.empty': '🛰️ No images found.',
    'mars.emptyHint': 'Try another rover, year, or search term.',
    'mars.count': '{{count}} image(s)',
    'mars.loadMore': 'Load more',
    'mars.end': '✦ End of results ✦',
    'mars.cardBrand': 'Mars',
    'mars.cardFallbackDesc': "Image from NASA's archive.",
    'mars.viewImage': 'View image →',
    'mars.close': 'Close',

    // Sort
    'sort.relevance': 'Relevance',
    'sort.newest': 'Newest',
    'sort.oldest': 'Oldest',
  },
};
