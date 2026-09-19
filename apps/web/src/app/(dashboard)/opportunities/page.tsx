import React from 'react';
import { Header } from '@/components/header';
import { ComingSoon } from '@/components/coming-soon';

export default function OpportunitiesPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Header title="Opportunities & Deals" />
      <ComingSoon screenName="Deals & Requirement Gathering" />
    </div>
  );
}
