/**
 * TypeScript module declarations for Material UI (MUI v9 / 9.4.0).
 * Augments component prop interfaces to support standard JSX system props.
 */

import '@mui/material/Stack';
import '@mui/material/Typography';
import '@mui/material/Grid';
import '@mui/material/TextField';
import '@mui/material/Dialog';

declare module '@mui/material/Stack' {
  interface StackOwnProps {
    [key: string]: any;
  }
}

declare module '@mui/material/Typography' {
  interface TypographyOwnProps {
    [key: string]: any;
  }
}

declare module '@mui/material/Grid' {
  interface GridBaseProps {
    [key: string]: any;
  }
}

declare module '@mui/material/TextField' {
  interface BaseTextFieldProps {
    InputLabelProps?: any;
    [key: string]: any;
  }
}

declare module '@mui/material/Dialog' {
  interface DialogProps {
    disableEscapeKeyDown?: boolean;
    [key: string]: any;
  }
}
