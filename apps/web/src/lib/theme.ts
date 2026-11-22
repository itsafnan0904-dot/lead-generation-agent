import { createTheme } from '@mui/material/styles';

/**
 * Design tokens for the MUI layer. Values mirror the CSS variables in app/globals.css.
 * Graphite neutrals, one cobalt accent, IBM Plex, weights 400/500, 4px grid.
 */
export const tokens = {
  canvas: {
    base: '#141415',
    surface: '#19191b',
    surfaceSubtle: '#1e1e20',
    surfaceElevated: '#232325',
    surfaceHover: '#28282b',
  },
  border: {
    subtle: 'rgba(237, 237, 237, 0.06)',
    default: 'rgba(237, 237, 237, 0.09)',
    strong: 'rgba(237, 237, 237, 0.16)',
    focus: '#86a9f2',
  },
  text: {
    primary: '#ededed',
    secondary: '#a1a1a6',
    muted: '#85858b',
    inverse: '#ffffff',
  },
  accent: {
    primary: '#3d6fd8',
    primaryHover: '#3563c4',
    primaryLight: '#86a9f2',
    primaryMuted: 'rgba(94, 140, 235, 0.14)',
    success: '#4cc38a',
    successMuted: 'rgba(76, 195, 138, 0.12)',
    warning: '#e3a94d',
    warningMuted: 'rgba(227, 169, 77, 0.12)',
    danger: '#ee7378',
    dangerMuted: 'rgba(229, 72, 77, 0.14)',
    info: '#86a9f2',
    infoMuted: 'rgba(94, 140, 235, 0.12)',
  },
  spacing: { xxs: '4px', xs: '8px', sm: '12px', md: '16px', lg: '24px', xl: '32px', xxl: '48px' },
  radius: { xs: '4px', sm: '8px', md: '12px', lg: '16px', full: '999px' },
  transition: {
    default: 'background-color 150ms cubic-bezier(0.22, 1, 0.36, 1), border-color 150ms cubic-bezier(0.22, 1, 0.36, 1)',
    fast: 'background-color 120ms cubic-bezier(0.22, 1, 0.36, 1), border-color 120ms cubic-bezier(0.22, 1, 0.36, 1)',
  },
  shadow: {
    card: 'none',
    elevated: '0 8px 24px rgba(0, 0, 0, 0.4)',
  },
} as const;

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: { default: tokens.canvas.base, paper: tokens.canvas.surface },
    primary: { main: tokens.accent.primary, light: tokens.accent.primaryLight, dark: tokens.accent.primaryHover, contrastText: tokens.text.inverse },
    secondary: { main: tokens.accent.info, light: tokens.accent.primaryLight, dark: tokens.accent.primaryHover, contrastText: tokens.text.inverse },
    info: { main: tokens.accent.info, light: tokens.accent.primaryLight, dark: tokens.accent.primaryHover },
    success: { main: tokens.accent.success, light: '#6fd3a4', dark: '#3aa874' },
    warning: { main: tokens.accent.warning, light: '#edbd6f', dark: '#c48c32' },
    error: { main: tokens.accent.danger, light: '#f29296', dark: '#d2565b' },
    text: { primary: tokens.text.primary, secondary: tokens.text.secondary, disabled: tokens.text.muted },
    divider: tokens.border.subtle,
  },
  typography: {
    fontFamily: ['var(--font-sans)', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'].join(','),
    h1: { fontWeight: 500, fontSize: '1.5rem', lineHeight: 1.25, letterSpacing: '-0.02em' },
    h2: { fontWeight: 500, fontSize: '1.125rem', lineHeight: 1.3 },
    h3: { fontWeight: 500, fontSize: '0.9375rem', lineHeight: 1.4 },
    subtitle1: { fontSize: '0.875rem', color: tokens.text.secondary, lineHeight: 1.5 },
    subtitle2: { fontSize: '0.8125rem', color: tokens.text.secondary, fontWeight: 500 },
    body1: { fontSize: '0.875rem', lineHeight: 1.5, color: tokens.text.primary },
    body2: { fontSize: '0.8125rem', lineHeight: 1.5, color: tokens.text.secondary },
    caption: { fontSize: '0.75rem', lineHeight: 1.33, color: tokens.text.muted },
    button: { textTransform: 'none', fontWeight: 500, fontSize: '0.875rem' },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: tokens.canvas.base,
          color: tokens.text.primary,
          scrollbarColor: 'rgba(237,237,237,0.14) transparent',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { backgroundColor: tokens.canvas.surface, border: `1px solid ${tokens.border.subtle}`, boxShadow: tokens.shadow.card, borderRadius: 12 },
      },
    },
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: 'none', backgroundColor: tokens.canvas.surface } },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, padding: '8px 16px', fontWeight: 500, transition: tokens.transition.default },
        contained: {
          backgroundColor: tokens.accent.primary,
          color: '#ffffff',
          boxShadow: 'none',
          '&:hover': { backgroundColor: tokens.accent.primaryHover, boxShadow: 'none' },
        },
        outlined: {
          borderColor: tokens.border.default,
          backgroundColor: 'transparent',
          color: tokens.text.primary,
          '&:hover': { borderColor: tokens.border.strong, backgroundColor: tokens.canvas.surfaceHover },
        },
      },
    },
    MuiChip: {
      styleOverrides: { root: { fontWeight: 500, fontSize: '0.75rem', borderRadius: 4, height: '24px' } },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { borderBottom: `1px solid ${tokens.border.subtle}`, padding: '12px 16px' },
        head: { backgroundColor: tokens.canvas.surfaceSubtle, color: tokens.text.muted, fontWeight: 400, fontSize: '0.8125rem' },
      },
    },
    MuiTableRow: {
      styleOverrides: { root: { '&:hover': { backgroundColor: `${tokens.canvas.surfaceHover} !important` } } },
    },
    MuiAlert: { styleOverrides: { root: { borderRadius: 8, border: '1px solid' } } },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: tokens.canvas.surfaceElevated,
          border: `1px solid ${tokens.border.default}`,
          borderRadius: 16,
          boxShadow: tokens.shadow.elevated,
        },
      },
    },
  },
});
