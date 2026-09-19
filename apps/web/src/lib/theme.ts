import { createTheme } from '@mui/material/styles';

/**
 * ============================================================================
 * AI SALES AGENT — CENTRALIZED DESIGN TOKENS & ENTERPRISE DARK THEME
 * Reference: docs/DESIGN_SYSTEM.md (Linear / Vercel / Stripe discipline)
 * ============================================================================
 * 
 * DESIGN SYSTEM PRINCIPLES:
 * 1. Restrained dark neutral surface hierarchy (no heavy glass/rainbow gradients).
 * 2. High-contrast, intentional accent usage (color communicates meaning, not decoration).
 * 3. Precise 1px hairline borders over fuzzy outer glows.
 * 4. Crisp typographic hierarchy with defined scale and weights.
 * 5. Built for MUI v9 (@mui/material 9.4.0) with consistent web tokens.
 */

export const tokens = {
  // --- SURFACE & BACKGROUND HIERARCHY ---
  canvas: {
    base: '#0b0f19',        // Root canvas background
    surface: '#111827',     // Main card & container background
    surfaceSubtle: '#161f30', // Nested panels, inputs, table rows
    surfaceElevated: '#1e293b', // Modals, dropdowns, popovers
    surfaceHover: '#1f293d', // Interactive hover state
  },

  // --- BORDERS & DIVIDERS ---
  border: {
    subtle: 'rgba(255, 255, 255, 0.07)',  // Interior dividers, subtle grid lines
    default: 'rgba(255, 255, 255, 0.12)', // Standard card/container boundaries
    strong: 'rgba(255, 255, 255, 0.20)',  // Hovered card bounds, active borders
    focus: '#6366f1',                     // Interactive focus ring
  },

  // --- TYPOGRAPHIC COLORS ---
  text: {
    primary: '#f9fafb',   // Headings, key values, primary readable text
    secondary: '#9ca3af', // Labels, descriptions, secondary metadata
    muted: '#6b7280',     // Inactive badges, timestamps, subtle placeholders
    inverse: '#ffffff',   // Text on solid colored buttons
  },

  // --- SEMANTIC ACCENTS (Restrained, meaning-driven) ---
  accent: {
    primary: '#6366f1',        // Indigo: Primary actions & selected navigation
    primaryHover: '#4f46e5',   // Hover state for primary action
    primaryLight: '#818cf8',   // Highlights and focused active borders
    primaryMuted: 'rgba(99, 102, 241, 0.12)', // Subtle primary tag/alert backings

    success: '#10b981',        // Emerald: Active AI, approved, healthy
    successMuted: 'rgba(16, 185, 129, 0.12)',

    warning: '#f59e0b',        // Amber: Human review required, paused AI
    warningMuted: 'rgba(245, 158, 11, 0.12)',

    danger: '#f43f5e',         // Rose: Errors, restrictions, destructive actions
    dangerMuted: 'rgba(244, 63, 94, 0.12)',

    info: '#0ea5e9',           // Sky: AI research, info signals, enrichment
    infoMuted: 'rgba(14, 165, 233, 0.12)',
  },

  // --- SPACING SCALE (4px grid rhythm) ---
  spacing: {
    xxs: '4px',
    xs: '8px',
    sm: '12px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },

  // --- CORNER RADII ---
  radius: {
    sm: '6px',      // Inputs, buttons, small tags
    md: '10px',     // Standard cards, table containers
    lg: '12px',     // Large modals, major section wrappers
    full: '9999px', // Pill badges, status indicators
  },

  // --- TRANSITIONS ---
  transition: {
    default: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
    fast: 'all 100ms cubic-bezier(0.4, 0, 0.2, 1)',
  },

  // --- RESTRAINED SHADOWS (Hairline elevations, no fuzzy neon) ---
  shadow: {
    card: '0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px -1px rgba(0, 0, 0, 0.3)',
    elevated: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
    glowFocus: '0 0 0 2px rgba(99, 102, 241, 0.25)',
  }
} as const;

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: tokens.canvas.base,
      paper: tokens.canvas.surface,
    },
    primary: {
      main: tokens.accent.primary,
      light: tokens.accent.primaryLight,
      dark: tokens.accent.primaryHover,
      contrastText: tokens.text.inverse,
    },
    secondary: {
      main: tokens.accent.info,
      light: '#38bdf8',
      dark: '#0284c7',
      contrastText: tokens.text.inverse,
    },
    info: {
      main: tokens.accent.info,
      light: '#38bdf8',
      dark: '#0284c7',
    },
    success: {
      main: tokens.accent.success,
      light: '#34d399',
      dark: '#059669',
    },
    warning: {
      main: tokens.accent.warning,
      light: '#fbbf24',
      dark: '#d97706',
    },
    error: {
      main: tokens.accent.danger,
      light: '#fb7185',
      dark: '#e11d48',
    },
    text: {
      primary: tokens.text.primary,
      secondary: tokens.text.secondary,
      disabled: tokens.text.muted,
    },
    divider: tokens.border.subtle,
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'sans-serif',
    ].join(','),
    h1: {
      fontWeight: 700,
      fontSize: '1.5rem', // 24px
      lineHeight: 1.25,
      letterSpacing: '-0.025em',
    },
    h2: {
      fontWeight: 600,
      fontSize: '1.125rem', // 18px
      lineHeight: 1.3,
      letterSpacing: '-0.015em',
    },
    h3: {
      fontWeight: 600,
      fontSize: '0.9375rem', // 15px
      lineHeight: 1.4,
      letterSpacing: '-0.01em',
    },
    subtitle1: {
      fontSize: '0.875rem',
      color: tokens.text.secondary,
      lineHeight: 1.5,
    },
    subtitle2: {
      fontSize: '0.8125rem',
      color: tokens.text.secondary,
      fontWeight: 500,
      letterSpacing: '0.01em',
    },
    body1: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
      color: tokens.text.primary,
    },
    body2: {
      fontSize: '0.8125rem',
      lineHeight: 1.45,
      color: tokens.text.secondary,
    },
    caption: {
      fontSize: '0.75rem',
      lineHeight: 1.33,
      color: tokens.text.muted,
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
      fontSize: '0.875rem',
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: tokens.canvas.base,
          color: tokens.text.primary,
          scrollbarColor: '#374151 #111827',
          '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
            width: '6px',
            height: '6px',
          },
          '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
            borderRadius: 6,
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
          },
          '&::-webkit-scrollbar-track, & *::-webkit-scrollbar-track': {
            backgroundColor: tokens.canvas.surface,
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: tokens.canvas.surface,
          border: `1px solid ${tokens.border.default}`,
          boxShadow: tokens.shadow.card,
          borderRadius: 10,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: tokens.canvas.surface,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          padding: '8px 16px',
          fontWeight: 500,
          transition: tokens.transition.default,
        },
        contained: {
          backgroundColor: tokens.accent.primary,
          color: '#ffffff',
          boxShadow: 'none',
          '&:hover': {
            backgroundColor: tokens.accent.primaryHover,
            boxShadow: 'none',
          },
        },
        outlined: {
          borderColor: tokens.border.default,
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          color: tokens.text.primary,
          '&:hover': {
            borderColor: tokens.border.strong,
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          fontSize: '0.75rem',
          borderRadius: 9999,
          height: '24px',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${tokens.border.subtle}`,
          padding: '12px 16px',
        },
        head: {
          backgroundColor: tokens.canvas.surfaceSubtle,
          color: tokens.text.secondary,
          fontWeight: 600,
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: `${tokens.canvas.surfaceHover} !important`,
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          border: '1px solid',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: tokens.canvas.surfaceElevated,
          border: `1px solid ${tokens.border.default}`,
          borderRadius: 12,
          boxShadow: tokens.shadow.elevated,
        },
      },
    },
  },
});
