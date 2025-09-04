// Stub provisório. Depois trocamos para chamar a Edge Function 'discover'.
export async function discoverMovies(_opts?: { page?: number; filters?: any }) {
  return { results: [] as Array<{ title: string; year: number | null; poster_url: string }> }
}
