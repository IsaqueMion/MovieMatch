// supabase/functions/movie_details/index.ts
const corsBase = {
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Vary': 'Origin'
};
Deno.serve(async (req)=>{
  const origin = req.headers.get('Origin') ?? '*';
  const headers = {
    ...corsBase,
    'Access-Control-Allow-Origin': origin
  };
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers
    });
  }
  try {
    const url = new URL(req.url);
    const idStr = url.searchParams.get('tmdb_id');
    if (!idStr) {
      return new Response(JSON.stringify({
        error: 'tmdb_id required'
      }), {
        status: 400,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
    }
    const tmdbId = Number(idStr);
    if (!Number.isSafeInteger(tmdbId) || tmdbId < 1) return new Response(JSON.stringify({ error: 'Invalid tmdb_id' }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
    const requestedLanguage = url.searchParams.get('language') ?? 'pt-BR';
    const language = ['pt-BR', 'en-US', 'es-ES'].includes(requestedLanguage) ? requestedLanguage : 'pt-BR';
    const requestedRegion = url.searchParams.get('region') ?? 'BR';
    const region = /^[A-Z]{2}$/.test(requestedRegion) ? requestedRegion : 'BR';
    const TMDB_KEY = Deno.env.get('TMDB_KEY') || '';
    if (!TMDB_KEY) {
      return new Response(JSON.stringify({
        error: 'TMDB_KEY not set'
      }), {
        status: 500,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });
    }
    // Detecta v3 (chave "curta") x v4 (token longo que começa com "eyJ")
    const isV4 = TMDB_KEY.startsWith('eyJ');
    // -------- helpers --------
    const fetchDetails = async (language)=>{
      const base = `https://api.themoviedb.org/3/movie/${tmdbId}`;
      const params = new URLSearchParams({
        language,
        append_to_response: 'release_dates,videos'
      });
      if (!isV4) params.set('api_key', TMDB_KEY);
      const r = await fetch(`${base}?${params.toString()}`, {
        headers: isV4 ? {
          Authorization: `Bearer ${TMDB_KEY}`
        } : {}
      });
      if (!r.ok) throw new Error(`TMDB ${r.status}`);
      return await r.json();
    };
    // 👇 **NOVA** função para buscar provedores
    const fetchProviders = async ()=>{
      const u = new URL(`https://api.themoviedb.org/3/movie/${tmdbId}/watch/providers`);
      if (!isV4) u.searchParams.set('api_key', TMDB_KEY);
      const r = await fetch(u.toString(), {
        headers: isV4 ? {
          Authorization: `Bearer ${TMDB_KEY}`
        } : {}
      });
      if (!r.ok) throw new Error(`TMDB providers ${r.status}`);
      return await r.json(); // { results: { BR: {...}, US: {...}, ... } }
    };
    // -------------------------
    // Tenta pt-BR e, se a overview vier vazia, faz fallback en-US
    const pt = await fetchDetails(language);
    if (!pt?.overview || String(pt.overview).trim().length === 0) {
      try {
        const en = await fetchDetails('en-US');
        if (en?.overview) pt.overview = en.overview;
      } catch { /* Keep an empty synopsis if the fallback is unavailable. */ }
    }
    // Trailer do YouTube (prioriza official e maior size)
    let trailerKey = null;
    const vids = pt?.videos?.results ?? [];
    const trailers = vids.filter((v)=>v.site === 'YouTube' && v.type === 'Trailer');
    if (trailers.length) {
      trailers.sort((a, b)=>Number(b.official) - Number(a.official) || Number(b.size || 0) - Number(a.size || 0));
      trailerKey = trailers[0]?.key ?? null;
    }
    // Classificação (BR > US)
    let age = '';
    const rels = pt?.release_dates?.results ?? [];
    const pick = (iso)=>rels.find((x)=>x.iso_3166_1 === iso)?.release_dates?.[0]?.certification || '';
    age = pick(region);
    // 👇 **NOVO**: busca providers
    let providersJson = null;
    try {
      providersJson = await fetchProviders(); // { results: { BR: {...}, US: {...}, ... } }
    } catch { /* Details remain useful without provider data. */ }
    const body = {
      tmdb_id: tmdbId,
      title: pt?.title ?? pt?.name ?? '',
      year: pt?.release_date ? Number(pt.release_date.slice(0, 4)) : null,
      poster_url: pt?.poster_path ? `https://image.tmdb.org/t/p/w500${pt.poster_path}` : null,
      vote_average: typeof pt?.vote_average === 'number' ? pt.vote_average : null,
      genres: Array.isArray(pt?.genres) ? pt.genres.map((g)=>({
          id: g.id,
          name: g.name
        })) : [],
      runtime: typeof pt?.runtime === 'number' ? pt.runtime : null,
      overview: typeof pt?.overview === 'string' ? pt.overview : '',
      trailer: trailerKey ? {
        key: trailerKey
      } : null,
      age_rating: age,
      // 👇 **NOVO**: devolve providers para o front
      providers_keys: providersJson?.results ? Object.keys(providersJson.results) : [],
      providers: providersJson?.results ?? null,
    };
    return new Response(JSON.stringify(body), {
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({
      error: String(e)
    }), {
      status: 500,
      headers: {
        ...corsBase,
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      }
    });
  }
});
