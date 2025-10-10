// src/lib/providers.ts
//
// Mapeia provedores de streaming do mundo todo para URLs de BUSCA na plataforma
// quando não temos deeplink específico do título.
// Regras:
// 1) Tentamos bater por ID do TMDB (quando conhecido).
// 2) Se o ID não bater, fazemos fallback por NOME (case-insensitive).
// 3) A URL sempre faz uma busca pelo título; sem ano para não “matar” resultados.
// 4) region (país) é usado nos serviços que têm path com país (ex.: tv.apple.com/<cc>/search)

type ProviderMatcher = {
  // Nome “humano” (apenas informativo)
  label: string;
  // IDs TMDB conhecidos (quando você tiver mais, pode adicionar aqui)
  ids?: number[];
  // Palavras-chave que, se aparecerem no nome, ativam esse provedor
  nameIncludes?: string[]; // tudo lowercase
  // Gera a URL de busca a partir do título e região
  toUrl: (title: string, region?: string) => string;
};

// util
const cc = (region?: string) => String(region || "BR").toLowerCase();
const q = (title: string) => encodeURIComponent(title);

// TABELA ampla de provedores (inclui globais e regionais populares)
const TABLE: ProviderMatcher[] = [
  // Globais / amplamente disponíveis
  { label: "Netflix", ids: [8], nameIncludes: ["netflix"], toUrl: (t) => `https://www.netflix.com/search?q=${q(t)}` },
  { label: "Prime Video", ids: [119], nameIncludes: ["prime", "amazon"], toUrl: (t) => `https://www.primevideo.com/search?phrase=${q(t)}` },
  { label: "Disney+", ids: [337], nameIncludes: ["disney"], toUrl: (t) => `https://www.disneyplus.com/search/${q(t)}` },
  { label: "Max / HBO Max", ids: [384], nameIncludes: ["max", "hbo"], toUrl: (t) => `https://play.max.com/search?q=${q(t)}` },
  { label: "Apple TV+", ids: [350], nameIncludes: ["apple tv"], toUrl: (t, r) => `https://tv.apple.com/${cc(r)}/search?term=${q(t)}` },
  { label: "Paramount+", ids: [531], nameIncludes: ["paramount"], toUrl: (t, r) => `https://www.paramountplus.com/${cc(r)}/search/${q(t)}` },
  { label: "Star+", ids: [619], nameIncludes: ["star+"], toUrl: (t) => `https://www.starplus.com/search/${q(t)}` },
  { label: "YouTube (aluguel/compra)", ids: [192], nameIncludes: ["youtube"], toUrl: (t) => `https://www.youtube.com/results?search_query=${q(t)}` },
  { label: "Google TV / Play Movies", ids: [3], nameIncludes: ["google play", "google tv", "play movies"], toUrl: (t) => `https://www.google.com/search?q=${q(t)}+site%3Aplay.google.com` },
  { label: "iTunes", ids: [2], nameIncludes: ["itunes"], toUrl: (t) => `https://itunes.apple.com/search?media=movie&term=${q(t)}` },

  // EUA
  { label: "Hulu", ids: [15], nameIncludes: ["hulu"], toUrl: (t) => `https://www.hulu.com/search?q=${q(t)}` },
  { label: "Peacock", ids: [386], nameIncludes: ["peacock"], toUrl: (t) => `https://www.peacocktv.com/search?q=${q(t)}` },
  { label: "Tubi", ids: [73], nameIncludes: ["tubi"], toUrl: (t) => `https://tubitv.com/search/${q(t)}` },
  { label: "Pluto TV", ids: [283], nameIncludes: ["pluto"], toUrl: (t) => `https://pluto.tv/search?query=${q(t)}` },
  { label: "Freevee", ids: [582], nameIncludes: ["freevee", "imdb tv"], toUrl: (t) => `https://www.amazon.com/gp/video/search?query=${q(t)}` },
  { label: "Crackle", ids: [28], nameIncludes: ["crackle"], toUrl: (t) => `https://www.crackle.com/search?q=${q(t)}` },

  // Brasil / LATAM
  { label: "Globoplay", ids: [307], nameIncludes: ["globoplay"], toUrl: (t) => `https://globoplay.globo.com/busca/?q=${q(t)}` },
  { label: "Claro video", ids: [167], nameIncludes: ["claro video"], toUrl: (t) => `https://www.clarovideo.com/brasil/busqueda?busqueda=${q(t)}` },
  { label: "Movistar Plus+", ids: [3370], nameIncludes: ["movistar"], toUrl: (t) => `https://ver.movistarplus.es/busqueda/?q=${q(t)}` },

  // Europa
  { label: "Canal+", ids: [381], nameIncludes: ["canal+"], toUrl: (t) => `https://www.canalplus.com/recherche?q=${q(t)}` },
  { label: "myCanal", nameIncludes: ["mycanal"], toUrl: (t) => `https://www.canalplus.com/recherche?q=${q(t)}` },
  { label: "BBC iPlayer", ids: [26], nameIncludes: ["iplayer", "bbc"], toUrl: (t) => `https://www.bbc.co.uk/iplayer/search?q=${q(t)}` },
  { label: "ITVX (ITV)", ids: [29], nameIncludes: ["itv"], toUrl: (t) => `https://www.itv.com/watch/search?q=${q(t)}` },
  { label: "Channel 4 (All 4)", ids: [20], nameIncludes: ["all 4", "channel 4", "4od"], toUrl: (t) => `https://www.channel4.com/search?q=${q(t)}` },
  { label: "NOW (UK)", ids: [39], nameIncludes: ["now tv"], toUrl: (t) => `https://www.nowtv.com/ie/watchlist/search?q=${q(t)}` },
  { label: "Sky Go", ids: [29], nameIncludes: ["sky go"], toUrl: (t) => `https://www.sky.com/watch/search?q=${q(t)}` },
  { label: "SkyShowtime", ids: [675], nameIncludes: ["skyshowtime"], toUrl: (t) => `https://www.skyshowtime.com/search/${q(t)}` },
  { label: "Rakuten TV (EU)", ids: [35], nameIncludes: ["rakuten"], toUrl: (t) => `https://www.rakuten.tv/pt/search?query=${q(t)}` },
  { label: "Filmin (ES/PT)", ids: [128], nameIncludes: ["filmin"], toUrl: (t) => `https://www.filmin.es/buscar?q=${q(t)}` },
  { label: "RTL+", ids: [431], nameIncludes: ["rtl+"], toUrl: (t) => `https://www.rtlplus.com/search?q=${q(t)}` },
  { label: "Joyn (DE)", ids: [513], nameIncludes: ["joyn"], toUrl: (t) => `https://www.joyn.de/suche?q=${q(t)}` },
  { label: "MagentaTV (DE)", nameIncludes: ["magentatv"], toUrl: (t) => `https://web.magentatv.de/search/${q(t)}` },
  { label: "Videoland (NL)", ids: [71], nameIncludes: ["videoland"], toUrl: (t) => `https://www.videoland.com/nl/search?q=${q(t)}` },
  { label: "Viaplay (Nordics/NL)", ids: [76], nameIncludes: ["viaplay"], toUrl: (t) => `https://viaplay.com/search?q=${q(t)}` },
  { label: "C MORE (Nordics)", nameIncludes: ["c more", "cmore"], toUrl: (t) => `https://www.cmore.se/sok/${q(t)}` },
  { label: "MUBI", ids: [11], nameIncludes: ["mubi"], toUrl: (t) => `https://mubi.com/films?query=${q(t)}` },
  { label: "Curiosity Stream", ids: [190], nameIncludes: ["curiosity"], toUrl: (t) => `https://curiositystream.com/search/${q(t)}` },

  // Ásia
  { label: "Hotstar (Disney+ Hotstar)", ids: [122], nameIncludes: ["hotstar"], toUrl: (t) => `https://www.hotstar.com/in/search?q=${q(t)}` },
  { label: "iQIYI", ids: [356], nameIncludes: ["iqiyi"], toUrl: (t) => `https://www.iq.com/search?query=${q(t)}` },
  { label: "Viu", ids: [430], nameIncludes: ["viu"], toUrl: (t) => `https://www.viu.com/ott/my/en-us/search?q=${q(t)}` },
  { label: "Tencent Video", ids: [457], nameIncludes: ["tencent", "wetv"], toUrl: (t) => `https://v.qq.com/x/search/?q=${q(t)}` },
  { label: "Youku", ids: [1905], nameIncludes: ["youku"], toUrl: (t) => `https://so.youku.com/search_video/q_${q(t)}` },
  { label: "BiliBili", nameIncludes: ["bilibili"], toUrl: (t) => `https://search.bilibili.com/all?keyword=${q(t)}` },

  // ANIME
  { label: "Crunchyroll", ids: [283], nameIncludes: ["crunchyroll"], toUrl: (t) => `https://www.crunchyroll.com/search?from=&q=${q(t)}` },
  { label: "Funimation", ids: [448], nameIncludes: ["funimation"], toUrl: (t) => `https://www.funimation.com/search/?q=${q(t)}` },

  // Oceania
  { label: "Stan (AU)", ids: [142], nameIncludes: ["stan"], toUrl: (t) => `https://www.stan.com.au/search?q=${q(t)}` },
  { label: "Binge (AU)", ids: [385], nameIncludes: ["binge"], toUrl: (t) => `https://binge.com.au/search?q=${q(t)}` },
  { label: "Foxtel Now (AU)", ids: [493], nameIncludes: ["foxtel"], toUrl: (t) => `https://www.foxtel.com.au/search.html?q=${q(t)}` },
  { label: "NEON (NZ)", ids: [248], nameIncludes: ["neon"], toUrl: (t) => `https://www.neontv.co.nz/search?q=${q(t)}` },
  { label: "TVNZ+", ids: [4309], nameIncludes: ["tvnz"], toUrl: (t) => `https://www.tvnz.co.nz/search?query=${q(t)}` },
  { label: "SBS On Demand (AU)", ids: [275], nameIncludes: ["sbs"], toUrl: (t) => `https://www.sbs.com.au/ondemand/search/${q(t)}` },
  { label: "9Now (AU)", ids: [224], nameIncludes: ["9now"], toUrl: (t) => `https://www.9now.com.au/search?q=${q(t)}` },
  { label: "7plus (AU)", ids: [326], nameIncludes: ["7plus"], toUrl: (t) => `https://7plus.com.au/search?q=${q(t)}` },

  // Oriente Médio
  { label: "Shahid", ids: [310], nameIncludes: ["shahid"], toUrl: (t) => `https://shahid.mbc.net/en/search?q=${q(t)}` },
  { label: "OSN+", ids: [5317], nameIncludes: ["osn"], toUrl: (t) => `https://osnplus.com/en/search/${q(t)}` },

  // Índia
  { label: "ZEE5", ids: [232], nameIncludes: ["zee5"], toUrl: (t) => `https://www.zee5.com/search?q=${q(t)}` },
  { label: "Sony LIV", ids: [237], nameIncludes: ["sony liv", "sonyliv"], toUrl: (t) => `https://www.sonyliv.com/search/all/${q(t)}` },

  // Documentários / nicho
  { label: "Plex", ids: [538], nameIncludes: ["plex"], toUrl: (t) => `https://watch.plex.tv/search?q=${q(t)}` },
];

function normalizeName(s?: string) {
  return String(s || "").toLowerCase();
}

/**
 * providerSearchUrl
 * Retorna uma URL de busca no site/app do provedor com base no ID ou nome.
 * Use quando NÃO houver deeplink exato (p.url) vindo do backend.
 */
export function providerSearchUrl(
  providerId: number | undefined,
  title: string,
  region?: string,
  providerName?: string
): string | undefined {
  const id = Number(providerId);
  const name = normalizeName(providerName);

  // 1) tenta por ID
  const byId = TABLE.find((p) => Array.isArray(p.ids) && p.ids.includes(id));
  if (byId) return byId.toUrl(title, region);

  // 2) tenta por nome (contains)
  const byName = TABLE.find(
    (p) => Array.isArray(p.nameIncludes) && p.nameIncludes.some((k) => name.includes(k))
  );
  if (byName) return byName.toUrl(title, region);

  // 3) nenhum match
  return undefined;
}
