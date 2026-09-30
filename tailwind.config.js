/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cinema: { bg: 'var(--cinema-bg)', surface: 'var(--cinema-surface)', ink: 'var(--cinema-ink)', muted: 'var(--cinema-muted)', accent: 'var(--cinema-accent)', line: 'var(--cinema-line)' },
      },
      fontFamily: {
        display: ['Bricolage Grotesque', 'system-ui', 'sans-serif'],
        body: ['Manrope', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
