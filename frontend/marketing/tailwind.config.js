/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{njk,html,js}', './_includes/**/*.{njk,html,js}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'Noto Sans',
          'sans-serif',
        ],
      },
      colors: {
        anatomia: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          500: '#14b8a6',
          600: '#0d9488',
          900: '#134e4a',
        },
      },
    },
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        anatomiax: {
          primary: '#14b8a6',
          'primary-content': '#ffffff',
          secondary: '#0ea5e9',
          'secondary-content': '#ffffff',
          accent: '#06b6d4',
          'accent-content': '#ffffff',
          neutral: '#1e293b',
          'neutral-content': '#f1f5f9',
          'base-100': '#0b1220',
          'base-200': '#0f172a',
          'base-300': '#1e293b',
          'base-content': '#e2e8f0',
          info: '#0284c7',
          success: '#059669',
          warning: '#d97706',
          error: '#dc2626',
        },
      },
      'dark',
    ],
    darkTheme: 'anatomiax',
    base: true,
    styled: true,
    utils: true,
    prefix: '',
    logs: false,
  },
};
