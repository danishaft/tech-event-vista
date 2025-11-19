import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-body)", ...fontFamily.sans],
        heading: ["var(--font-heading)", ...fontFamily.sans],
        body: ["var(--font-body)", ...fontFamily.sans],
      },
      colors: {
        border: "hsl(var(--border) / var(--border-opacity))",
        "border-hover": "hsl(var(--border-hover) / var(--border-hover-opacity))",
        input: "hsl(var(--input) / var(--input-opacity))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          hover: "hsl(var(--primary-hover))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
          "foreground-light": "hsl(var(--muted-foreground-light))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          hover: "hsl(var(--accent-hover))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        surface: "hsl(var(--surface))",
        "surface-hover": "hsl(var(--surface-hover))",
        "surface-active": "hsl(var(--surface-active))",
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        info: "hsl(var(--info))",
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      backgroundImage: {
        'gradient-primary': 'var(--gradient-primary)',
        'gradient-surface': 'var(--gradient-surface)',
        'gradient-accent': 'var(--gradient-accent)',
      },
      spacing: {
        'section': 'var(--spacing-section)',
        'content': 'var(--spacing-content)',
        'card': 'var(--spacing-card)',
        'internal': 'var(--spacing-internal)',
      },
      fontSize: {
        'h1': 'var(--font-size-h1)',
        'h2': 'var(--font-size-h2)',
        'h3': 'var(--font-size-h3)',
        'body': 'var(--font-size-body)',
        'button': 'var(--font-size-button)',
        'small': 'var(--font-size-small)',
      },
      fontWeight: {
        'normal': 'var(--font-weight-normal)',
        'medium': 'var(--font-weight-medium)',
        'semibold': 'var(--font-weight-semibold)',
        'bold': 'var(--font-weight-bold)',
      },
      letterSpacing: {
        'tight': 'var(--letter-spacing-tight)',
        'normal': 'var(--letter-spacing-normal)',
        'wide': 'var(--letter-spacing-wide)',
      },
      boxShadow: {
        'sm': 'var(--shadow-sm)',
        'md': 'var(--shadow-md)',
        'lg': 'var(--shadow-lg)',
        'card': 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        'glow': 'var(--shadow-glow)',
        // Layered shadows pattern
        'layer-1': '0px 12px 24px 0px hsla(229, 84%, 5%, 0.08)',
        'layer-2': '0px 6px 12px -2px hsla(0, 0%, 0%, 0.08)',
        'layer-3': '0px 3px 6px -3px hsla(0, 0%, 0%, 0.35)',
        'card-sm': '0px 0px 0px 1px rgba(0, 0, 0, 0.07)',
        'card-lg': '0px_0px_0px_1px_rgba(0,0,0,0.07),0px_15px_30px_-15px_rgba(0,0,0,0.20),0px_15px_15px_-8px_rgba(0,0,0,0.08),0px_12px_15.9px_-6px_rgba(0,0,0,0.03)',
        'card-xl': '0px_0px_0px_1px_rgba(0,0,0,0.11),0px_16px_24.4px_-12px_rgba(0,0,0,0.15),0px_25px_50px_-6px_rgba(0,0,0,0.13),0px_2px_2px_-2px_rgba(0,0,0,0.20)',
        'input': '0px 0px 0px 1px rgba(0, 0, 0, 0.11), 0px 0px 1px 0px rgba(0, 0, 0, 0.07)',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        DEFAULT: "var(--radius)",
        // Doow-specific border radius values (very curvy/rounded appearance)
        "doow-sm": "0.75rem",       /* 12px - buttons, small elements (very curvy) */
        "doow-md": "1rem",          /* 16px - medium elements (very curvy) */
        "doow-lg": "1.25rem",       /* 20px - large elements (very curvy) */
        "doow-xl": "1.5rem",        /* 24px - cards, containers */
        xl: "calc(var(--radius) + 4px)",
        pill: "9999px",             /* Fully rounded (Doow pattern) */
        circle: "50%",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
