import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ContactsService', () => {
  let service: ContactsService;
  let prismaService: any;

  const mockCompany = {
    id: 'comp-uuid-1',
    name: 'Apex Industrial Supply',
  };

  const mockContact = {
    id: 'contact-uuid-1',
    companyId: 'comp-uuid-1',
    email: 'sarah.connor@apexindustrial.com',
    firstName: 'Sarah',
    lastName: 'Connor',
    title: 'Director of Procurement',
    phone: '+1-555-0199',
    linkedinUrl: null,
    timezone: 'America/Chicago',
    isPrimary: true,
    metadata: null,
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
          create: jest.fn(),
          findUnique: jest.fn(),
          findMany: jest.fn(),
          updateMany: jest.fn(),
          update: jest.fn(),
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactsService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<ContactsService>(ContactsService);
  });

  describe('Contact Creation & Duplicate Email Detection', () => {
    it('successfully creates a contact attached to a valid company', async () => {
      prismaService.client.company.findUnique.mockResolvedValue(mockCompany);
      prismaService.client.contact.findUnique.mockResolvedValue(null);
      prismaService.client.contact.create.mockResolvedValue(mockContact);

      const result = await service.createContact('comp-uuid-1', {
        email: 'sarah.connor@apexindustrial.com',
        firstName: 'Sarah',
        lastName: 'Connor',
        isPrimary: true,
      });

      expect(result.id).toBe('contact-uuid-1');
      expect(prismaService.client.contact.create).toHaveBeenCalled();
    });

    it('rejects contact creation with 409 Conflict when email is already registered', async () => {
      prismaService.client.company.findUnique.mockResolvedValue(mockCompany);
      prismaService.client.contact.findUnique.mockResolvedValue(mockContact);

      await expect(
        service.createContact('comp-uuid-1', {
          email: 'sarah.connor@apexindustrial.com',
          firstName: 'Sarah',
        }),
      ).rejects.toThrow(ConflictException);

      expect(prismaService.client.contact.create).not.toHaveBeenCalled();
    });

    it('rejects contact creation with 404 NotFound when parent company does not exist', async () => {
      prismaService.client.company.findUnique.mockResolvedValue(null);

      await expect(
        service.createContact('nonexistent-comp', {
          email: 'user@nowhere.com',
          firstName: 'Anon',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
