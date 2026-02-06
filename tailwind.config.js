/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{tsx,ts,jsx,js,html}'],
  theme: {
    extend: {
      colors: {
        'bg-primary': 'var(--bg-primary)',
        'bg-secondary': 'var(--bg-secondary)',
        'bg-tertiary': 'var(--bg-tertiary)',
        'bg-hover': 'var(--bg-hover)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-muted': 'var(--text-muted)',
        'accent': 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        'success': 'var(--success)',
        'warning': 'var(--warning)',
        'error': 'var(--error)',
        'border': 'var(--border)',
      },
      boxShadow: {
        'sm': 'var(--shadow-sm)',
        'md': 'var(--shadow-md)',
        'lg': 'var(--shadow-lg)',
        'glow': 'var(--shadow-glow)',
      },
      backgroundImage: {
        'gradient-accent': 'var(--gradient-accent)',
        'gradient-primary': 'var(--gradient-primary)',
        'gradient-subtle': 'var(--gradient-subtle)',
      },
    },
  },
  plugins: [],
}
