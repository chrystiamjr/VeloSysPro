/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bgMain: '#12141c',
        bgSidebar: '#181c28',
        bgCard: '#1c1f2b',
        bgCardHover: '#222636',
        borderColor: '#2a2f42',
        textMain: '#f0f2f5',
        textMuted: '#9aa1b2',
        
        // Design System Theme Color Tokens
        primary: {
          DEFAULT: '#2d6edc',
          hover: '#3b7cf0',
        },
        success: {
          DEFAULT: '#00a86b',
          hover: '#00c47d',
        },
        purple: {
          DEFAULT: '#7a3ff2',
          hover: '#8c54f5',
        },
        warning: {
          DEFAULT: '#e38b22',
          hover: '#f09b33',
        },
        pink: {
          DEFAULT: '#c84d9b',
          hover: '#d85eac',
        },
        info: {
          DEFAULT: '#1796c8',
          hover: '#24a8db',
        },
        danger: {
          DEFAULT: '#d94343',
          hover: '#e55656',
        },
      },
      borderRadius: {
        card: '14px',
        container: '12px',
      },
      // Status glows, tokenized so no component hardcodes a hex shadow.
      boxShadow: {
        // The lift a sticky action bar casts over the content scrolling beneath it. Upward, and
        // deeper than a card's, because it has to read as the surface the screen sits on.
        'action-bar': '0 -8px 24px rgba(0, 0, 0, 0.35)',
        'glow-success': '0 0 8px #00a86b',
        'glow-warning': '0 0 8px #e38b22',
        'glow-danger': '0 0 8px #d94343',
        'glow-info': '0 0 8px #1796c8',
      },
    },
  },
  plugins: [],
}
