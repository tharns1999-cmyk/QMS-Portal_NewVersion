/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dream: {
          canvas: 'var(--dc-canvas)',
          surface: 'var(--dc-surface-primary)',
          'surface-soft': 'var(--dc-surface-soft)',
          primary: 'var(--dc-text-primary)',
          secondary: 'var(--dc-text-secondary)',
          muted: 'var(--dc-text-muted)',
          lavender: 'var(--dc-lavender)',
          mint: 'var(--dc-mint)',
          blue: 'var(--dc-blue)',
        },
      },
      textColor: {
        dream: {
          primary: 'var(--dc-text-primary)',
          secondary: 'var(--dc-text-secondary)',
          muted: 'var(--dc-text-muted)',
        },
      },
      backgroundColor: {
        dream: {
          canvas: 'var(--dc-canvas)',
          surface: 'var(--dc-surface-primary)',
          'surface-soft': 'var(--dc-surface-soft)',
          lavender: 'var(--dc-lavender)',
          mint: 'var(--dc-mint)',
          blue: 'var(--dc-blue)',
        },
      },
      borderColor: {
        dream: {
          subtle: 'var(--dc-border-subtle)',
        },
      },
      boxShadow: {
        dream: 'var(--dc-shadow-soft)',
        floating: '0 20px 50px rgba(40, 35, 80, 0.12), 0 4px 12px rgba(40, 35, 80, 0.06)',
      },
      lineHeight: {
        relaxed: '1.55',
        spacious: '1.6',
      },
    },
  },
  plugins: [],
};
