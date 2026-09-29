import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        burgundy: {
          DEFAULT: '#8A1538',
          hover: '#A61B4A',
          light: '#FDF2F4',
          border: '#F4B5C6',
        },
        surface: '#FFFFFF',
        page: '#F8FAFC',
        text: {
          primary: '#1F2937',
          secondary: '#6B7280',
          muted: '#9CA3AF',
        },
        border: {
          DEFAULT: '#E5E7EB',
          focus: '#8A1538',
        },
        crowd: {
          empty: '#10B981',   // Vắng (Green)
          medium: '#F59E0B',  // Vừa (Amber)
          full: '#EF4444',    // Đông (Red)
          unknown: '#9CA3AF', // Chưa có dữ liệu (Gray)
        }
      },
      fontFamily: {
        sans: ['var(--font-be-vietnam)', 'Be Vietnam Pro', 'sans-serif'],
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
      },
      boxShadow: {
        'soft': '0 2px 10px rgba(0, 0, 0, 0.05)',
        'elevated': '0 8px 30px rgba(0, 0, 0, 0.08)',
      }
    },
  },
  plugins: [],
};
export default config;
