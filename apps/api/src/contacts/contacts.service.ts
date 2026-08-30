import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto';
import { Contact } from '@ai-sales-agent/database';

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a contact scoped to an existing company.
   * Enforces global unique constraint on email with explicit 409 Conflict error.
   */
  async createContact(companyId: string, dto: CreateContactDto): Promise<Contact> {
    const company = await this.prisma.client.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException(`Company with ID '${companyId}' not found.`);
    }

    const normalizedEmail = dto.email.toLowerCase().trim();

    const existingEmail = await this.prisma.client.contact.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingEmail) {
      throw new ConflictException(
        `Contact with email '${normalizedEmail}' already exists (attached to Company ID: ${existingEmail.companyId}).`,
      );
    }

    // If this contact is marked as isPrimary, unmark existing primary contacts for this company
    if (dto.isPrimary) {
      await this.prisma.client.contact.updateMany({
        where: { companyId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    return this.prisma.client.contact.create({
      data: {
        companyId,
        email: normalizedEmail,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName?.trim() || null,
        title: dto.title?.trim() || null,
        phone: dto.phone?.trim() || null,
        linkedinUrl: dto.linkedinUrl?.trim() || null,
        timezone: dto.timezone?.trim() || null,
        isPrimary: dto.isPrimary ?? false,
        metadata: dto.metadata || undefined,
      },
    });
  }

  /**
   * Lists all contacts for a given company.
   */
  async getContactsByCompany(companyId: string): Promise<Contact[]> {
    const company = await this.prisma.client.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException(`Company with ID '${companyId}' not found.`);
    }

    return this.prisma.client.contact.findMany({
      where: { companyId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Retrieves a single contact by ID.
   */
  async getContactById(id: string): Promise<Contact> {
    const contact = await this.prisma.client.contact.findUnique({
      where: { id },
      include: {
        company: {
          select: { id: true, name: true, domain: true },
        },
      },
    });

    if (!contact) {
      throw new NotFoundException(`Contact with ID '${id}' not found.`);
    }

    return contact;
  }

  /**
   * Updates an existing contact.
   */
  async updateContact(id: string, dto: UpdateContactDto): Promise<Contact> {
    const existing = await this.getContactById(id);

    if (dto.email) {
      const normalizedEmail = dto.email.toLowerCase().trim();
      if (normalizedEmail !== existing.email) {
        const emailCollision = await this.prisma.client.contact.findUnique({
          where: { email: normalizedEmail },
        });
        if (emailCollision) {
          throw new ConflictException(
            `Contact with email '${normalizedEmail}' already exists.`,
          );
        }
        dto.email = normalizedEmail;
      }
    }

    if (dto.isPrimary) {
      await this.prisma.client.contact.updateMany({
        where: { companyId: existing.companyId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    return this.prisma.client.contact.update({
      where: { id },
      data: {
        ...(dto.email ? { email: dto.email } : {}),
        ...(dto.firstName ? { firstName: dto.firstName.trim() } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName?.trim() || null } : {}),
        ...(dto.title !== undefined ? { title: dto.title?.trim() || null } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
        ...(dto.linkedinUrl !== undefined ? { linkedinUrl: dto.linkedinUrl?.trim() || null } : {}),
        ...(dto.timezone !== undefined ? { timezone: dto.timezone?.trim() || null } : {}),
        ...(dto.isPrimary !== undefined ? { isPrimary: dto.isPrimary } : {}),
        ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
      },
    });
  }
}
