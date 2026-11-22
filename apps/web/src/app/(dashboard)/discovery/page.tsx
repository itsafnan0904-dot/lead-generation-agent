import React from 'react';
import { Header } from '@/components/header';
import { ImportProspects } from './import-prospects';

export default function DiscoveryPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Header title="Import prospects" />
      <ImportProspects />
    </div>
  );
}
