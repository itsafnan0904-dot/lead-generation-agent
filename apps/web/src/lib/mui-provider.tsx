'use client';

import * as React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeRegistry } from './emotion-registry';
import { darkTheme } from './theme';

export function MuiProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeRegistry options={{ key: 'mui' }}>
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeRegistry>
  );
}
