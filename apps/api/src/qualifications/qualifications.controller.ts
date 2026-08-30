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
import { QualificationsService } from './qualifications.service';
import { CreateQualificationDto, UpdateQualificationDto } from './dto/qualification.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class QualificationsController {
  constructor(private readonly qualificationsService: QualificationsService) {}

  /**
   * Creates a Qualification record scoped to a Lead.
   */
  @Post('leads/:leadId/qualifications')
  async createQualification(
    @Param('leadId') leadId: string,
    @Body() dto: CreateQualificationDto,
  ) {
    return this.qualificationsService.createQualification(leadId, dto);
  }

  /**
   * Lists all Qualification records for a specific Lead.
   */
  @Get('leads/:leadId/qualifications')
  async getQualificationsByLead(@Param('leadId') leadId: string) {
    return this.qualificationsService.getQualificationsByLead(leadId);
  }

  /**
   * Retrieves a single Qualification record by ID.
   */
  @Get('qualifications/:id')
  async getQualificationById(@Param('id') id: string) {
    return this.qualificationsService.getQualificationById(id);
  }

  /**
   * Updates an existing Qualification record.
   */
  @Patch('qualifications/:id')
  async updateQualification(
    @Param('id') id: string,
    @Body() dto: UpdateQualificationDto,
  ) {
    return this.qualificationsService.updateQualification(id, dto);
  }
}
