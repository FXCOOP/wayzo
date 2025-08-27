/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./layouts/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "Noto Sans", "sans-serif"],
      },
      colors: {
        primary: {
          DEFAULT: "#2563EB",
          50: "#EEF2FF",
          100: "#E0EAFF",
          200: "#C7D7FE",
          300: "#9AB8FD",
          400: "#6A98FB",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8",
          800: "#1E40AF",
          900: "#1E3A8A"
        },
        accent: {
          purple: "#7C3AED",
          orange: "#F97316",
          teal: "#14B8A6"
        }
      },
      backgroundImage: {
        'gradient-hero': 'linear-gradient(135deg, #0ea5e9 0%, #22c55e 100%)',
      },
      boxShadow: {
        card: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms')
  ],
}

