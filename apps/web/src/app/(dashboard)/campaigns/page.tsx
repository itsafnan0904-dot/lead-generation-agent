import React from 'react';
import { Header } from '@/components/header';
import { ComingSoon } from '@/components/coming-soon';

export default function CampaignsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Header title="Campaigns & Sequences" />
      <ComingSoon screenName="Automated Outreach Campaigns" />
    </div>
  );
}
