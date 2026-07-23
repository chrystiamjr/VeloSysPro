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
    },
  },
  plugins: [],
}
