import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ContactsService } from './contacts.service';
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  /**
   * Creates a contact scoped to a specific parent company.
   */
  @Post('companies/:companyId/contacts')
  async createContact(
    @Param('companyId') companyId: string,
    @Body() dto: CreateContactDto,
  ) {
    return this.contactsService.createContact(companyId, dto);
  }

  /**
   * Lists all contacts for a specific company.
   */
  @Get('companies/:companyId/contacts')
  async getContactsByCompany(@Param('companyId') companyId: string) {
    return this.contactsService.getContactsByCompany(companyId);
  }

  /**
   * Retrieves a single contact by contact ID.
   */
  @Get('contacts/:id')
  async getContactById(@Param('id') id: string) {
    return this.contactsService.getContactById(id);
  }

  /**
   * Updates an existing contact by contact ID.
   */
  @Patch('contacts/:id')
  async updateContact(
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contactsService.updateContact(id, dto);
  }
}
