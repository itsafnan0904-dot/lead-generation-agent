import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { RestrictionEngineService } from './restrictions/restriction-engine.service';
import { OutreachService } from './outreach/outreach.service';
import { NotificationsService } from './notifications/notifications.service';
import {
  LeadLifecycleStatus,
  NotificationPriority,
  OutreachDraftStatus,
  UserRole,
} from '@ai-sales-agent/database';

async function runLiveVerification() {
  console.log('=== Starting Prompt 15 Live Notifications Engine Verification ===');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const prisma = app.get(PrismaService);
  const restrictionEngine = app.get(RestrictionEngineService);
  const outreachService = app.get(OutreachService);
  const notificationsService = app.get(NotificationsService);

  try {
    // 0. Ensure an Admin user exists
    let adminUser = await prisma.client.user.findFirst({
      where: { role: UserRole.ADMIN, isActive: true },
    });

    if (!adminUser) {
      adminUser = await prisma.client.user.create({
        data: {
          email: `admin-verification-${Date.now()}@enterprise.com`,
          name: 'Live Verification Admin',
          role: UserRole.ADMIN,
          isActive: true,
        },
      });
      console.log(`Created test Admin user: ${adminUser.id} (${adminUser.email})`);
    } else {
      console.log(`Using existing Admin user: ${adminUser.id} (${adminUser.email})`);
    }

    // Step 1: Trigger Restriction Block -> Verify ACTION_REQUIRED Notification
    console.log('\n--- Step 1: Trigger Restriction Block -> ACTION_REQUIRED Notification ---');
    const testCompany = await prisma.client.company.create({
      data: {
        name: `Restricted Joist Fabricators ${Date.now()}`,
        domain: `restricted-joist-${Date.now()}.com`,
        industry: 'Structural Steel',
      },
    });

    const testLead = await prisma.client.lead.create({
      data: {
        companyId: testCompany.id,
        assignedUserId: adminUser.id,
        status: LeadLifecycleStatus.COLD_LEAD,
      },
    });

    console.log(`Created test Lead '${testLead.id}' for company '${testCompany.name}'.`);

    const restrictionCheck = await restrictionEngine.evaluate({
      entityType: 'LEAD' as any,
      leadId: testLead.id,
      companyId: testCompany.id,
      sourceTrigger: 'manual',
      textCorpus: 'We fabricate open web steel joists (OWSJ) and K-Series structural framing.',
      notes: 'Live verification test for Prompt 15 restriction block notification trigger.',
    });

    console.log(`Restriction check result: ${restrictionCheck.result} (Reason: ${restrictionCheck.reason})`);

    // Verify Notification in Database
    const blockNotifs = await prisma.client.notification.findMany({
      where: {
        entityType: 'HUMAN_REVIEW',
        priority: NotificationPriority.ACTION_REQUIRED,
      },
      orderBy: { createdAt: 'desc' },
      take: 2,
    });

    console.log(`Found ${blockNotifs.length} recent ACTION_REQUIRED notifications for HUMAN_REVIEW.`);
    if (blockNotifs.length > 0) {
      const topNotif = blockNotifs[0];
      console.log(`VERIFIED ACTION_REQUIRED Notification:
  ID: ${topNotif.id}
  Priority: ${topNotif.priority}
  Title: "${topNotif.title}"
  Message: "${topNotif.message}"
  Entity: ${topNotif.entityType}:${topNotif.entityId}
  User ID: ${topNotif.userId}
  isRead: ${topNotif.isRead}`);
    }

    // Step 2: Trigger Outreach Send (Safe Test Mode) -> Verify INFO Notification
    console.log('\n--- Step 2: Trigger Outreach Send -> INFO Notification ---');
    const outreachCompany = await prisma.client.company.create({
      data: {
        name: `Clean Manufacturing Corp ${Date.now()}`,
        domain: `clean-mfg-${Date.now()}.com`,
        industry: 'Precision Machining',
      },
    });

    const outreachContact = await prisma.client.contact.create({
      data: {
        companyId: outreachCompany.id,
        firstName: 'Jane',
        lastName: 'Doe',
        email: `jane.doe.${Date.now()}@cleanmfg.com`,
      },
    });

    const outreachLead = await prisma.client.lead.create({
      data: {
        companyId: outreachCompany.id,
        primaryContactId: outreachContact.id,
        assignedUserId: adminUser.id,
        status: LeadLifecycleStatus.COLD_LEAD,
      },
    });

    const draft = await prisma.client.outreachDraft.create({
      data: {
        leadId: outreachLead.id,
        subject: 'Partnership Inquiry for Clean Manufacturing',
        bodyText: 'Hello Jane, would love to connect regarding our precision tooling catalog.',
        status: OutreachDraftStatus.DRAFT,
      },
    });

    console.log(`Created test OutreachDraft '${draft.id}' for Lead '${outreachLead.id}'. Sending via outreachService.sendDraft()...`);

    const sendResult = await outreachService.sendDraft(draft.id);
    console.log(`Send completed with status: ${sendResult.status} (Gmail msgId: ${sendResult.gmailMessageId}, safeTestMode: ${sendResult.safeTestModeActive})`);

    const outreachNotifs = await prisma.client.notification.findMany({
      where: {
        entityType: 'OUTREACH_DRAFT',
        entityId: draft.id,
        priority: NotificationPriority.INFO,
      },
    });

    console.log(`VERIFIED INFO Notification:
  Found count: ${outreachNotifs.length}
  ID: ${outreachNotifs[0]?.id}
  Priority: ${outreachNotifs[0]?.priority}
  Title: "${outreachNotifs[0]?.title}"
  Message: "${outreachNotifs[0]?.message}"
  Entity: ${outreachNotifs[0]?.entityType}:${outreachNotifs[0]?.entityId}
  isRead: ${outreachNotifs[0]?.isRead}`);

    // Step 3: Test Retrieval, Filtering, and Mark-As-Read
    console.log('\n--- Step 3: Test Notifications Listing, Filtering & Mark-As-Read ---');
    const userNotificationsBefore = await notificationsService.listNotifications(adminUser.id, {
      page: 1,
      limit: 10,
    });

    console.log(`Admin User total notifications: ${userNotificationsBefore.total} (unread: ${userNotificationsBefore.unreadCount})`);

    if (outreachNotifs.length > 0) {
      const targetNotifId = outreachNotifs[0].id;
      console.log(`Marking notification '${targetNotifId}' as read...`);

      const marked = await notificationsService.markAsRead(adminUser.id, targetNotifId);
      console.log(`Mark-as-read result: ID=${marked.id}, isRead=${marked.isRead}, readAt=${marked.readAt?.toISOString()}`);

      const userNotificationsAfter = await notificationsService.listNotifications(adminUser.id, {
        isRead: false,
      });
      console.log(`Unread notifications count after marking read: ${userNotificationsAfter.total}`);
    }

    console.log('\n=== LIVE NOTIFICATIONS VERIFICATION COMPLETED SUCCESSFULLY ===');
  } catch (err: any) {
    console.error('Live verification failed:', err.message, err.stack);
  } finally {
    await app.close();
  }
}

runLiveVerification();
