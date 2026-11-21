'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';

interface NavState {
  open: boolean;
  toggle: () => void;
  close: () => void;
}

const NavContext = createContext<NavState>({ open: false, toggle: () => undefined, close: () => undefined });
export const useNav = () => useContext(NavContext);

/** Page frame: sidebar on the left (a slide-in drawer on small screens) and the page on the right. */
export function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((o) => !o), []);

  // Close the drawer after navigating, and with Escape
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <NavContext.Provider value={{ open, toggle, close }}>
      <div className="shell">
        <Sidebar open={open} />
        <div className={`scrim${open ? ' open' : ''}`} onClick={close} aria-hidden="true" />
        <div className="shell-main">{children}</div>
      </div>
    </NavContext.Provider>
  );
}
