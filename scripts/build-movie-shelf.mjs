import { readFile, writeFile } from 'node:fs/promises'

// Derive from the registered ThreeUI engine; keep its canonical source byte-exact.
export async function buildMovieShelf() {
  let html = await readFile(new URL('../public/landing-pages/complete-shelf-v2.html', import.meta.url), 'utf8')
  const start = html.indexOf('    const BOOKS = [')
  const end = html.indexOf('    const COVER_ATLAS_DATA', start)
  if (start < 0 || end < 0) throw new Error('ThreeUI source structure changed')
  const templates = html.slice(start, end).replace('const BOOKS', 'const BOOK_TEMPLATES')
  html = html.slice(0, start) + templates + `
    let BOOKS = [];
    let shelfLabels;
    const moviePosters = new Map();
    const shelfData = new Promise(resolve => {
      function receive(event) {
        if (event.source !== parent || event.origin !== location.origin || event.data?.type !== 'moviematch:shelf:data') return;
        if (!Array.isArray(event.data.movies) || !event.data.movies.length) return;
        window.removeEventListener('message', receive);
        resolve(event.data);
      }
      window.addEventListener('message', receive);
    });
    function exploreMovie(book) {
      parent.postMessage({type: 'moviematch:shelf:open', movieId: book.movieId}, location.origin);
    }
  ` + html.slice(end)
  html = html.replace('</head>', '<style>main:not(.moviematch-ready){visibility:hidden}.pointer-label{display:none!important}.fallback__grid{grid-template-columns:repeat(auto-fit,minmax(140px,1fr))}</style></head>')
  // Software artworks are never loaded by the movie variant.
  html = html.replace(/const COVER_ATLAS_DATA = "[^"\r\n]*";/, 'const COVER_ATLAS_DATA = "";')
  html = html.replace('      if (coverAtlasReady) {', `
      const poster = moviePosters.get(book.movieId);
      if (poster) {
        ctx.drawImage(poster, 0, 0, canvasTexture.width, canvasTexture.height);
        return configureCanvasTexture(new THREE.CanvasTexture(canvasTexture));
      }
      if (!poster) {
        ctx.fillStyle = '#17231d'; ctx.fillRect(0, 0, canvasTexture.width, canvasTexture.height);
        ctx.fillStyle = '#75efb8'; ctx.font = '600 60px sans-serif';
        const words = book.title.split(/\\s+/); let line = ''; let y = 400;
        for (const word of words) {
          if (ctx.measureText(line + ' ' + word).width > 620 && line) { ctx.fillText(line, 60, y, 640); line = ''; y += 80; }
          line += (line ? ' ' : '') + word;
        }
        ctx.fillText(line, 60, y, 640);
        return configureCanvasTexture(new THREE.CanvasTexture(canvasTexture));
      }
      if (coverAtlasReady) {`)
  // The original front foil repeats software lettering over its artwork.
  html = html.replace('const foilTexture = makeFoilTexture(book);', 'const foilTexture = configureCanvasTexture(new THREE.CanvasTexture(document.createElement("canvas")));')
  html = html.replace('    function openDetail(origin = inspectButton) {', `    function openDetail(origin = inspectButton) {
      if (parent !== window) { exploreMovie(BOOKS[mod(Math.round(targetPosition), BOOKS.length)]); return; }`)
  html = html.replace('`Open ${book.title}`', '`\${shelfLabels.explore}: \${book.title}`')
  html = html.replace('`Select volume ${index + 1}: ${book.title}`', '`\${shelfLabels.select} \${index + 1}: \${book.title}`')
  html = html.replace('`Selected volume ${selectedIndex + 1} of ${BOOKS.length}: ${book.title}. ${book.note}`', '`\${selectedIndex + 1} / \${BOOKS.length}: \${book.title}. \${book.note}`')
  html = html.replace('    initialize().catch(() => {', `
    shelfData.then(async ({movies, labels, language}) => {
      shelfLabels = labels;
      document.documentElement.lang = language;
      BOOKS = movies.map((movie, index) => ({
        ...BOOK_TEMPLATES[0],
        id: String(movie.movie_id), movieId: movie.movie_id, title: movie.title,
        roman: String(index + 1), discipline: labels.heading,
        note: [movie.year, labels.consensus.replace('{0}', movie.likes).replace('{1}', movie.member_count)].filter(Boolean).join(' · '),
        deck: movie.title, binding: labels.heading, format: String(movie.year || ''),
        theme: labels.heading, motif: '', paletteLabel: labels.heading,
        chapters: [movie.title, labels.heading, labels.explore],
        color: '#182a43', foil: '#75efb8',
      }));
      document.querySelector('.editorial-identity strong').textContent = 'MovieMatch';
      document.querySelector('.editorial-identity span').textContent = labels.heading;
      document.querySelector('.editorial-index span').textContent = labels.count.replace('{0}', BOOKS.length);
      selectionTitle.textContent = BOOKS[0].title;
      selectionNote.textContent = BOOKS[0].note;
      counter.textContent = '01 / ' + pad(BOOKS.length);
      inspectButton.textContent = labels.explore;
      previousButton.setAttribute('aria-label', labels.previous);
      nextButton.setAttribute('aria-label', labels.next);
      previousButton.hidden = nextButton.hidden = BOOKS.length === 1;
      document.querySelector('.index-nav .microcopy').textContent = labels.navigation;
      document.querySelector('.pointer-label').hidden = true;
      document.querySelector('#fallback-title').textContent = labels.heading;
      document.querySelector('.fallback__kicker').textContent = 'MovieMatch';
      document.querySelector('.fallback__footer').hidden = true;
      const grid = document.querySelector('.fallback__grid');
      grid.replaceChildren(...BOOKS.map(book => {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'fallback-book';
        button.textContent = book.title;
        button.addEventListener('click', () => exploreMovie(book));
        return button;
      }));
      document.querySelector('#loading p').textContent = labels.loading;
      experience.classList.add('moviematch-ready');
      // A missing/blocked poster falls back to the authored cover with the movie title.
      await Promise.all(movies.map(movie => new Promise(resolve => {
        if (!movie.poster_url) { resolve(); return; }
        let url;
        try { url = new URL(movie.poster_url, location.href); } catch { resolve(); return; }
        if (url.origin !== location.origin && (url.protocol !== 'https:' || url.hostname !== 'image.tmdb.org')) { resolve(); return; }
        const image = new Image(); image.crossOrigin = 'anonymous';
        const timer = setTimeout(() => resolve(), 5000);
        image.onload = () => { clearTimeout(timer); moviePosters.set(movie.movie_id, image); resolve(); };
        image.onerror = () => { clearTimeout(timer); resolve(); };
        image.src = url.href;
      })));
      await initialize();
    }).catch(() => {`)
  html = html.replaceAll('The interactive shelf could not be prepared. The complete static catalog remains available.', 'MovieMatch: 3D unavailable.').replaceAll('WebGL is unavailable in this browser. The complete static catalog remains available.', 'MovieMatch: WebGL unavailable.').replaceAll('Working Volumes', 'MovieMatch')
  await writeFile(new URL('../public/landing-pages/movie-shelf.html', import.meta.url), html)
  return html
}
