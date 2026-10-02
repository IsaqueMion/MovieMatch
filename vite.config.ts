import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { buildMovieShelf } from './scripts/build-movie-shelf.mjs'

await buildMovieShelf()

export default defineConfig({
  plugins: [react()],
})
