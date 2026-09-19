import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });

import { PrismaClient, NotificationPriority } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== STEP 1: TEST DATA DISCLOSURE & PREPARATION ===');
  const adminUser = await prisma.user.findUnique({
    where: { email: 'admin@enterprise.com' },
  });
  if (!adminUser) throw new Error('admin@enterprise.com not found');

  const summitLead = await prisma.lead.findUnique({
    where: { id: '428c73eb-39f8-4806-8d88-fdff1815069d' },
    include: { company: true },
  });
  if (!summitLead) throw new Error('Summit lead not found');

  // Check if ACTION_REQUIRED notification already exists or create test notification
  let actionRequiredNotif = await prisma.notification.findFirst({
    where: {
      userId: adminUser.id,
      priority: NotificationPriority.ACTION_REQUIRED,
      entityType: 'HUMAN_REVIEW',
    },
  });

  if (!actionRequiredNotif) {
    actionRequiredNotif = await prisma.notification.create({
      data: {
        userId: adminUser.id,
        priority: NotificationPriority.ACTION_REQUIRED,
        title: 'Policy Escalation: Lead Requires Human Review',
        message: 'Lead outreach restricted by policy engine. Commercial Real Estate asset holding requires manager sign-off.',
        entityType: 'HUMAN_REVIEW',
        entityId: 'hr-summit-holdings-eval',
        isRead: false,
        metadata: {
          leadId: summitLead.id,
          companyName: summitLead.company.name,
          reason: 'Commercial Real Estate restricted asset review',
          actorType: 'SYSTEM',
        },
      },
    });
    console.log('[EXPLICIT TEST DATA DISCLOSURE]: Created test notification for HUMAN_REVIEW:');
  } else {
    // Reset to unread for testing
    actionRequiredNotif = await prisma.notification.update({
      where: { id: actionRequiredNotif.id },
      data: { isRead: false, readAt: null },
    });
    console.log('[EXPLICIT TEST DATA DISCLOSURE]: Using existing HUMAN_REVIEW notification (reset to unread):');
  }
  console.log(`- Notification ID: ${actionRequiredNotif.id}`);
  console.log(`- Entity Type: ${actionRequiredNotif.entityType}`);
  console.log(`- Entity ID: ${actionRequiredNotif.entityId}`);
  console.log(`- Target Lead ID (in metadata): ${(actionRequiredNotif.metadata as any).leadId}`);
  console.log(`- Priority: ${actionRequiredNotif.priority}`);

  console.log('\n=== STEP 2: AUTHENTICATION VIA API ===');
  const loginRes = await fetch('http://localhost:4000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@enterprise.com',
      password: 'Password123!',
    }),
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed with status ${loginRes.status}: ${await loginRes.text()}`);
  }
  const loginData: any = await loginRes.json();
  const token = loginData.tokens.accessToken;
  console.log(`Successfully authenticated as ${adminUser.email}. Token obtained.`);

  console.log('\n=== STEP 3: LIVE FILTER TRACES ===');
  const headers = { Authorization: `Bearer ${token}` };

  // Query ALL (no priority param)
  const resAll = await fetch('http://localhost:4000/notifications', { headers });
  const dataAll: any = await resAll.json();
  if (!resAll.ok) console.error('resAll error:', dataAll);
  console.log(`- Filter ALL: returned total=${dataAll.total}, unreadCount=${dataAll.unreadCount}, items count=${dataAll.items?.length}`);

  // Query ACTION_REQUIRED
  const resAction = await fetch('http://localhost:4000/notifications?priority=ACTION_REQUIRED', { headers });
  const dataAction: any = await resAction.json();
  console.log(`- Filter ACTION_REQUIRED: returned total=${dataAction.total}, items count=${dataAction.items.length}`);
  if (dataAction.items.length > 0) {
    console.log(`  Top Item: "${dataAction.items[0].title}" (Priority: ${dataAction.items[0].priority}, Entity: ${dataAction.items[0].entityType})`);
  }

  // Query IMPORTANT
  const resImportant = await fetch('http://localhost:4000/notifications?priority=IMPORTANT', { headers });
  const dataImportant: any = await resImportant.json();
  console.log(`- Filter IMPORTANT: returned total=${dataImportant.total}, items count=${dataImportant.items.length}`);
  if (dataImportant.items.length > 0) {
    console.log(`  Top Item: "${dataImportant.items[0].title}" (Priority: ${dataImportant.items[0].priority}, Entity: ${dataImportant.items[0].entityType})`);
  }

  // Query INFO
  const resInfo = await fetch('http://localhost:4000/notifications?priority=INFO', { headers });
  const dataInfo: any = await resInfo.json();
  console.log(`- Filter INFO: returned total=${dataInfo.total}, items count=${dataInfo.items.length}`);
  if (dataInfo.items.length > 0) {
    console.log(`  Top Item: "${dataInfo.items[0].title}" (Priority: ${dataInfo.items[0].priority}, Entity: ${dataInfo.items[0].entityType})`);
  }

  // Query UNREAD ONLY
  const resUnread = await fetch('http://localhost:4000/notifications?isRead=false', { headers });
  const dataUnread: any = await resUnread.json();
  console.log(`- Filter UNREAD ONLY (isRead=false): returned total=${dataUnread.total}, items count=${dataUnread.items.length}`);

  // Database cross-check for accuracy
  const dbCounts = await prisma.notification.groupBy({
    by: ['priority'],
    where: { userId: adminUser.id },
    _count: { id: true },
  });
  console.log('\n--- Database Record Cross-Check ---');
  console.log('Database counts for user:', dbCounts);
  const dbUnread = await prisma.notification.count({ where: { userId: adminUser.id, isRead: false } });
  console.log(`Database unread total: ${dbUnread} (API unreadCount: ${dataAll.unreadCount})`);

  console.log('\n=== STEP 4: MARK AS READ & PERSISTENCE VERIFICATION ===');
  // Choose one unread notification to mark as read
  const unreadTarget = dataInfo.items.find((i: any) => !i.isRead) || dataAction.items[0];
  console.log(`Selected notification to mark read: ID=${unreadTarget.id} ("${unreadTarget.title}")`);

  const markRes = await fetch(`http://localhost:4000/notifications/${unreadTarget.id}/read`, {
    method: 'PATCH',
    headers,
  });
  const markData: any = await markRes.json();
  console.log(`PATCH /notifications/:id/read returned: isRead=${markData.isRead}, readAt=${markData.readAt}`);

  // INDEPENDENT DATABASE PERSISTENCE CHECK (not relying on API return)
  const dbPersisted = await prisma.notification.findUnique({
    where: { id: unreadTarget.id },
  });
  console.log(`Independent DB query: isRead=${dbPersisted?.isRead}, readAt=${dbPersisted?.readAt?.toISOString()}`);
  if (dbPersisted?.isRead === true && dbPersisted?.readAt) {
    console.log('>>> CONFIRMED: Mark-as-read successfully persisted to database.');
  } else {
    console.error('>>> FAILED: Mark-as-read failed persistence check!');
  }

  // Query unread count after mark-as-read
  const resAfter = await fetch('http://localhost:4000/notifications?limit=1', { headers });
  const dataAfter: any = await resAfter.json();
  console.log(`API unread count after mark-as-read: ${dataAfter.unreadCount} (previous: ${dataAll.unreadCount})`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
});
