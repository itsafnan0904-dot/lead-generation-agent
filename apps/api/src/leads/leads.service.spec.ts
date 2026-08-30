import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { PrismaService } from '../prisma/prisma.service';
import { LeadLifecycleStatus } from '@ai-sales-agent/database';

describe('LeadsService', () => {
  let service: LeadsService;
  let prismaService: any;

  const mockCompany = {
    id: 'comp-uuid-1',
    name: 'Apex Industrial Supply',
  };

  const mockContact = {
    id: 'contact-uuid-1',
    companyId: 'comp-uuid-1',
    email: 'sarah@apex.com',
  };

  const mockLead = {
    id: 'lead-uuid-1',
    companyId: 'comp-uuid-1',
    primaryContactId: 'contact-uuid-1',
    campaignId: null,
    assignedUserId: null,
    status: LeadLifecycleStatus.COLD_LEAD,
    scoreTotal: 0,
    scoreServiceMatch: 0,
    scoreCompanyRelevance: 0,
    scoreContactQuality: 0,
    scoreProjectPotential: 0,
    scoreLocationMatch: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prismaService = {
      client: {
        company: {
          findUnique: jest.fn(),
        },
        contact: {
          findUnique: jest.fn(),
        },
        campaign: {
          findUnique: jest.fn(),
        },
        user: {
          findUnique: jest.fn(),
        },
        lead: {
          create: jest.fn(),
          findUnique: jest.fn(),
          findMany: jest.fn(),
          count: jest.fn(),
          update: jest.fn(),
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<LeadsService>(LeadsService);
  });

  describe('Lead Creation & Validation', () => {
    it('successfully creates a Lead with valid companyId and defaults to COLD_LEAD', async () => {
      prismaService.client.company.findUnique.mockResolvedValue(mockCompany);
      prismaService.client.contact.findUnique.mockResolvedValue(mockContact);
      prismaService.client.lead.create.mockResolvedValue(mockLead);

      const result = await service.createLead({
        companyId: 'comp-uuid-1',
        primaryContactId: 'contact-uuid-1',
      });

      expect(result.id).toBe('lead-uuid-1');
      expect(result.status).toBe('COLD_LEAD');
      expect(prismaService.client.lead.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'comp-uuid-1',
            status: LeadLifecycleStatus.COLD_LEAD,
          }),
        }),
      );
    });

    it('rejects lead creation with 404 NotFound if companyId is invalid or does not exist', async () => {
      prismaService.client.company.findUnique.mockResolvedValue(null);

      await expect(
        service.createLead({
          companyId: 'nonexistent-comp-uuid',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(prismaService.client.lead.create).not.toHaveBeenCalled();
    });

    it('rejects lead creation with 400 BadRequest if primaryContactId belongs to a different company', async () => {
      prismaService.client.company.findUnique.mockResolvedValue(mockCompany);
      prismaService.client.contact.findUnique.mockResolvedValue({
        id: 'contact-other-uuid',
        companyId: 'different-comp-uuid-999',
      });

      await expect(
        service.createLead({
          companyId: 'comp-uuid-1',
          primaryContactId: 'contact-other-uuid',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prismaService.client.lead.create).not.toHaveBeenCalled();
    });
  });
});
