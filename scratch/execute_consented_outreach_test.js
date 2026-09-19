const API_BASE_URL = 'http://localhost:4000';

async function main() {
  console.log('=== STEP 1: AUTHENTICATING AS ADMIN ===');
  const loginRes = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@enterprise.com',
      password: 'Password123!',
    }),
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed: ${await loginRes.text()}`);
  }

  const loginData = await loginRes.json();
  const token = loginData.tokens.accessToken;
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  console.log('Admin authenticated successfully:', loginData.user.email);

  console.log('\n=== STEP 2: CREATING REAL TEST DATA (COMPANY, CONTACT, LEAD) ===');
  
  // 1. Create Test Company
  const companyPayload = {
    name: 'Apex Structural Engineering Consultants',
    domain: `apexstructural-${Date.now()}.com`,
    industry: 'Civil & Structural Engineering',
    location: 'Lahore, Pakistan',
    website: 'https://apexstructural.com',
  };

  const companyRes = await fetch(`${API_BASE_URL}/companies`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(companyPayload),
  });

  if (!companyRes.ok) {
    throw new Error(`Failed to create company: ${await companyRes.text()}`);
  }
  const company = await companyRes.json();
  console.log('Company created:', { id: company.id, name: company.name, industry: company.industry });

  // 2. Create Test Contact with consented email
  const contactPayload = {
    firstName: 'Afnan',
    lastName: 'Jawad',
    email: '70176613@student.uol.edu.pk',
    title: 'Principal Structural Lead',
    isPrimary: true,
  };

  const contactRes = await fetch(`${API_BASE_URL}/companies/${company.id}/contacts`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(contactPayload),
  });

  if (!contactRes.ok) {
    throw new Error(`Failed to create contact: ${await contactRes.text()}`);
  }
  const contact = await contactRes.json();
  console.log('Contact created:', { id: contact.id, name: `${contact.firstName} ${contact.lastName}`, email: contact.email });

  // 3. Create Test Lead
  const leadPayload = {
    companyId: company.id,
    primaryContactId: contact.id,
    assignedUserId: loginData.user.id,
  };

  const leadRes = await fetch(`${API_BASE_URL}/leads`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(leadPayload),
  });

  if (!leadRes.ok) {
    throw new Error(`Failed to create lead: ${await leadRes.text()}`);
  }
  const lead = await leadRes.json();
  console.log('Lead created:', { id: lead.id, status: lead.status, companyId: lead.companyId, contactId: lead.primaryContactId });

  console.log('\n=== STEP 3: GENERATING REAL AI OUTREACH DRAFT (POST /leads/:id/outreach/draft) ===');
  const t0 = Date.now();
  const draftRes = await fetch(`${API_BASE_URL}/leads/${lead.id}/outreach/draft`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      tone: 'professional and consultative',
      additionalContext: 'Introducing our AI Sales Agent enterprise solutions for engineering workflow scaling.',
    }),
  });

  const durationMs = Date.now() - t0;
  if (!draftRes.ok) {
    throw new Error(`Failed to generate outreach draft: ${await draftRes.text()}`);
  }
  const draft = await draftRes.json();
  console.log(`AI Draft generated in ${durationMs}ms:`);
  console.log('  Draft ID:', draft.id);
  console.log('  Subject:', draft.subject);
  console.log('  Body Preview:\n', draft.bodyText);
  console.log('  Call to Action:', draft.callToAction);
  console.log('  AI Usage Metadata:', JSON.stringify(draft.aiUsageMetadata, null, 2));

  console.log('\n=== STEP 4: SENDING REAL OUTREACH EMAIL (POST /outreach/:draftId/send) ===');
  const sendRes = await fetch(`${API_BASE_URL}/outreach/${draft.id}/send`, {
    method: 'POST',
    headers: authHeaders,
  });

  if (!sendRes.ok) {
    throw new Error(`Failed to send outreach draft: ${await sendRes.text()}`);
  }
  const sendResult = await sendRes.json();
  console.log('Email successfully dispatched!');
  console.log('Send Result Payload:\n', JSON.stringify(sendResult, null, 2));

  console.log('\n=== END-TO-END OUTREACH DISPATCH COMPLETE ===');
}

main().catch(err => {
  console.error('Execution error:', err);
  process.exit(1);
});
