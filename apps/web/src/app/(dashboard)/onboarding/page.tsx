import React from 'react';
import { Header } from '@/components/header';
import { OnboardingWizard } from './onboarding-wizard';

export default function OnboardingPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <Header title="Seller profile" />
      <OnboardingWizard />
    </div>
  );
}
