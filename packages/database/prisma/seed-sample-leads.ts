import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../apps/api/.env') });

import { PrismaClient, LeadLifecycleStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({ where: { email: 'admin@enterprise.com' } });
  if (!admin) {
    console.error('Admin user not found. Please ensure admin user exists.');
    return;
  }

  const sampleCompanies = [
    {
      name: 'Precision Casting & Forging Corp',
      domain: 'precision-forging.com',
      industry: 'Heavy Manufacturing',
      status: LeadLifecycleStatus.RESTRICTED,
      score: 35,
      contact: {
        firstName: 'David',
        lastName: 'Kowalski',
        email: 'd.kowalski@precision-forging.com',
        title: 'Plant Operations Director',
        phone: '+1 (412) 555-0193',
      },
    },
    {
      name: 'Vanguard Cyber Logistics Inc',
      domain: 'vanguard-logistics.com',
      industry: 'Supply Chain & Logistics',
      status: LeadLifecycleStatus.RESTRICTED,
      score: 42,
      contact: {
        firstName: 'Sarah',
        lastName: 'Jenkins',
        email: 's.jenkins@vanguard-logistics.com',
        title: 'Chief Operating Officer',
        phone: '+1 (312) 555-0188',
      },
    },
    {
      name: 'Apex Industrial Robotics LLC',
      domain: 'apex-robotics.com',
      industry: 'Industrial Automation',
      status: LeadLifecycleStatus.RESTRICTED,
      score: 50,
      contact: {
        firstName: 'Marcus',
        lastName: 'Vance',
        email: 'm.vance@apex-robotics.com',
        title: 'VP of Automation Engineering',
        phone: '+1 (512) 555-0142',
      },
    },
    {
      name: 'Summit Enterprise Holdings LLC',
      domain: 'summit-holdings.com',
      industry: 'Commercial Real Estate',
      status: LeadLifecycleStatus.HUMAN_REVIEW,
      score: 78,
      contact: {
        firstName: 'Rachel',
        lastName: 'Sterling',
        email: 'r.sterling@summit-holdings.com',
        title: 'Executive VP of Acquisitions',
        phone: '+1 (212) 555-0167',
      },
    },
    {
      name: 'Nexis Integrated Cloud Solutions',
      domain: 'nexis-cloud.io',
      industry: 'Enterprise Software',
      status: LeadLifecycleStatus.HUMAN_REVIEW,
      score: 65,
      contact: {
        firstName: 'Alexander',
        lastName: 'Chen',
        email: 'a.chen@nexis-cloud.io',
        title: 'VP of Infrastructure & Platform',
        phone: '+1 (415) 555-0131',
      },
    },
    {
      name: 'Strata Distributed Storage Systems',
      domain: 'stratastorage.io',
      industry: 'Data Infrastructure',
      status: LeadLifecycleStatus.QUALIFIED,
      score: 92,
      contact: {
        firstName: 'Tariq',
        lastName: 'Mansoor',
        email: 't.mansoor@stratastorage.io',
        title: 'Chief Technology Officer',
        phone: '+1 (408) 555-0155',
      },
    },
    {
      name: 'OmniGlobal Telecommunications Corp',
      domain: 'omniglobal-tel.com',
      industry: 'Telecommunications',
      status: LeadLifecycleStatus.WON,
      score: 95,
      contact: {
        firstName: 'Victoria',
        lastName: 'Hayes',
        email: 'v.hayes@omniglobal-tel.com',
        title: 'Senior VP of Enterprise Networks',
        phone: '+1 (404) 555-0129',
      },
    },
    {
      name: 'BioPharma Dynamics International',
      domain: 'biopharmadynamics.com',
      industry: 'Biotechnology',
      status: LeadLifecycleStatus.QUALIFIED,
      score: 88,
      contact: {
        firstName: 'Dr. Evelyn',
        lastName: 'Reed',
        email: 'e.reed@biopharmadynamics.com',
        title: 'Head of Clinical Pipeline',
        phone: '+1 (617) 555-0174',
      },
    },
    {
      name: 'TransContinental Freightway Corp',
      domain: 'transcontinental-freight.com',
      industry: 'Freight & Shipping',
      status: LeadLifecycleStatus.CONTACTED,
      score: 60,
      contact: {
        firstName: 'Brian',
        lastName: 'Gallagher',
        email: 'b.gallagher@transcontinental-freight.com',
        title: 'VP of Global Logistics',
        phone: '+1 (901) 555-0112',
      },
    },
    {
      name: 'AgriTech Nutritional Solutions Inc',
      domain: 'agritech-nutrition.com',
      industry: 'Agricultural Processing',
      status: LeadLifecycleStatus.COLD_LEAD,
      score: 45,
      contact: {
        firstName: 'Hannah',
        lastName: 'Morales',
        email: 'h.morales@agritech-nutrition.com',
        title: 'Director of Supply Chain',
        phone: '+1 (515) 555-0183',
      },
    },
    {
      name: 'TheraGen Biologics Laboratories',
      domain: 'theragen-bio.com',
      industry: 'Pharmaceutical Research',
      status: LeadLifecycleStatus.CONTACTED,
      score: 58,
      contact: {
        firstName: 'Dr. Julian',
        lastName: 'Mercer',
        email: 'j.mercer@theragen-bio.com',
        title: 'VP of Research & Development',
        phone: '+1 (858) 555-0146',
      },
    },
    {
      name: 'Applied Optics & Sensor Labs LLC',
      domain: 'applied-optics-labs.com',
      industry: 'Photonics & Sensor Systems',
      status: LeadLifecycleStatus.INTERESTED,
      score: 75,
      contact: {
        firstName: 'Dr. Lucas',
        lastName: 'Keller',
        email: 'l.keller@applied-optics-labs.com',
        title: 'Director of Photonics Engineering',
        phone: '+1 (520) 555-0199',
      },
    },
  ];

  console.log(`Seeding ${sampleCompanies.length} realistic B2B enterprise companies, contacts, and leads...`);

  for (const item of sampleCompanies) {
    let company = await prisma.company.findFirst({ where: { domain: item.domain } });
    if (!company) {
      company = await prisma.company.create({
        data: {
          name: item.name,
          domain: item.domain,
          industry: item.industry,
        },
      });
    }

    let contact = await prisma.contact.findFirst({ where: { email: item.contact.email } });
    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          companyId: company.id,
          firstName: item.contact.firstName,
          lastName: item.contact.lastName,
          email: item.contact.email,
          title: item.contact.title,
          phone: item.contact.phone,
          isPrimary: true,
        },
      });
    } else {
      contact = await prisma.contact.update({
        where: { id: contact.id },
        data: {
          companyId: company.id,
          firstName: item.contact.firstName,
          lastName: item.contact.lastName,
          email: item.contact.email,
          title: item.contact.title,
          phone: item.contact.phone,
          isPrimary: true,
        },
      });
    }

    const existingLead = await prisma.lead.findFirst({ where: { companyId: company.id } });
    if (!existingLead) {
      await prisma.lead.create({
        data: {
          companyId: company.id,
          primaryContactId: contact.id,
          assignedUserId: admin.id,
          status: item.status,
          scoreTotal: item.score,
        },
      });
    } else {
      await prisma.lead.update({
        where: { id: existingLead.id },
        data: {
          primaryContactId: contact.id,
          status: item.status,
          scoreTotal: item.score,
        },
      });
    }
  }

  const total = await prisma.lead.count();
  console.log(`Seeding complete. Total leads in database: ${total}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
});

