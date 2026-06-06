/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#020617',         // Slate 950 (Dominant 60%)
          card: '#0f172a',       // Slate 900 (Secondary 30%)
          cardLight: '#1e293b',  // Slate 800 (Card hover / input background)
          accent: '#10b981',     // Emerald 500 (Accent 10%)
          accentHover: '#059669',// Emerald 600 (Accent hover)
          border: '#334155',     // Slate 700
          textMuted: '#94a3b8',  // Slate 400
          textLight: '#f8fafc',  // Slate 50
        }
      },
      spacing: {
        // Enforcing 4px rule cleanly
        '1px': '1px',
        '2px': '2px',
        '4px': '4px',
        '8px': '8px',
        '12px': '12px',
        '16px': '16px',
        '20px': '20px',
        '24px': '24px',
        '28px': '28px',
        '32px': '32px',
        '36px': '36px',
        '40px': '40px',
        '48px': '48px',
        '64px': '64px',
      }
    },
  },
  plugins: [],
}
