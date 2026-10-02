// supabase/functions/discover/index.ts
function buildCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  // Pré-flight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Use POST" }), {
        status: 405,
        headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders },
      });
    }

    const TMDB_KEY = Deno.env.get("TMDB_KEY");
    if (!TMDB_KEY) throw new Error("TMDB_KEY missing");

    let body: { page?: number; displayLanguage?: string; filters?: { sortBy?: string; includeAdult?: boolean; language?: string; yearMin?: number; yearMax?: number; ratingMin?: number; voteCountMin?: number; runtimeMin?: number; runtimeMax?: number; genres?: number[]; excludeGenres?: number[]; providers?: number[]; watchRegion?: string; monetization?: string[] } } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    // ------- paginação -------
    const pageRaw = Number(body?.page ?? 1);
    // TMDB Discover tem limite de 500 páginas
    const page = Math.min(500, Math.max(1, Number.isFinite(pageRaw) ? Math.floor(pageRaw) : 1));

    const f = body?.filters ?? {};

    const qs = new URLSearchParams();

    // idioma das respostas da API
    qs.set("language", ["pt-BR", "en-US", "es-ES"].includes(body?.displayLanguage) ? body.displayLanguage : "pt-BR");

    // paginação / ordenação
    qs.set("page", String(page));
    qs.set("sort_by", typeof f.sortBy === "string" && f.sortBy ? f.sortBy : "popularity.desc");

    // bandeiras padrão
    qs.set("include_video", "false");
    qs.set("include_adult", String(!!f.includeAdult));

    // idioma original do filme (2 letras)
    if (f.language) {
      qs.set("with_original_language", String(f.language).toLowerCase());
    }

    // intervalo de ano (usa primary_release_date por ser mais flexível)
    const nowYear = new Date().getFullYear();
    if (f.yearMin) qs.set("primary_release_date.gte", `${Math.max(1900, Number(f.yearMin))}-01-01`);
    if (f.yearMax) qs.set("primary_release_date.lte", `${Math.min(nowYear, Number(f.yearMax))}-12-31`);

    // nota mínima (0–10)
    if (typeof f.ratingMin === "number") {
      const v = Math.max(0, Math.min(10, f.ratingMin));
      qs.set("vote_average.gte", String(v));
    }

    // votos mínimos (robustez)
    if (typeof f.voteCountMin === "number") {
      const v = Math.max(0, Math.floor(f.voteCountMin));
      qs.set("vote_count.gte", String(v));
    } else {
      qs.set("vote_count.gte", "50");
    }

    // duração min–max
    if (typeof f.runtimeMin === "number") {
      const v = Math.max(0, Math.floor(f.runtimeMin));
      qs.set("with_runtime.gte", String(v));
    }
    if (typeof f.runtimeMax === "number") {
      const v = Math.max(0, Math.floor(f.runtimeMax));
      qs.set("with_runtime.lte", String(v));
    }

    // gêneros incluir/excluir
    if (Array.isArray(f.genres) && f.genres.length) {
      qs.set("with_genres", f.genres.join(","));
    }
    if (Array.isArray(f.excludeGenres) && f.excludeGenres.length) {
      qs.set("without_genres", f.excludeGenres.join(","));
    }

    // 🔥 Streaming (usa seus nomes: providers / watchRegion / monetization)
    // Se houver provedores, aplicamos watch_region e monetization
    if (Array.isArray(f.providers) && f.providers.length) {
      const prov = [
        ...new Set(
          f.providers
            .map((n: unknown) => Number(n))
            .filter((n: number) => Number.isFinite(n) && n > 0),
        ),
      ];
      if (prov.length) {
        qs.set("with_watch_providers", prov.join("|"));

        if (f.watchRegion) {
          qs.set("watch_region", String(f.watchRegion).toUpperCase());
          // 'region' ajuda a ajustar datas/certificação por país
          qs.set("region", String(f.watchRegion).toUpperCase());
        }

        const monet: string[] =
          Array.isArray(f.monetization) && f.monetization.length ? f.monetization : ["flatrate"]; // default
        qs.set("with_watch_monetization_types", monet.join("|"));
      }
    } else if (f.watchRegion) {
      // Mesmo sem providers, podemos setar 'region' (não filtra catálogo, mas ajusta releases)
      qs.set("region", String(f.watchRegion).toUpperCase());
    }

    // chave (TMDB v3)
    qs.set("api_key", TMDB_KEY);

    const url = `https://api.themoviedb.org/3/discover/movie?${qs.toString()}`;
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      throw new Error(`TMDB discover error: ${r.status} ${txt}`);
    }

    const j = await r.json();

    // normalização de saída
    const results = (j?.results ?? []).map((m: { id: number; title?: string; name?: string; release_date?: string; poster_path?: string; genre_ids?: number[] }) => ({
      movie_id: m.id,
      tmdb_id: m.id,
      title: m.title ?? m.name ?? "",
      year: m.release_date ? Number(String(m.release_date).slice(0, 4)) : null,
      poster_url: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
      genres: Array.isArray(m.genre_ids) ? m.genre_ids : [],
    }));

    return new Response(
      JSON.stringify({
        page,
        total_pages: j?.total_pages ?? null,
        results,
      }),
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=120, s-maxage=120", // opcional
          ...corsHeaders,
        },
      },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 400,
      headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders },
    });
  }
});
