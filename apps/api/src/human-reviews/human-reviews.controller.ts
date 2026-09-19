import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@ai-sales-agent/database';
import { HumanReviewsService } from './human-reviews.service';
import { ResolveHumanReviewDto, ListHumanReviewsQueryDto } from './dto/human-review.dto';

@Controller('human-reviews')
@UseGuards(JwtAuthGuard)
export class HumanReviewsController {
  constructor(private readonly humanReviewsService: HumanReviewsService) {}

  /**
   * Lists Human Reviews with optional status/lead filters.
   * Gated behind JwtAuthGuard only (accessible to any authenticated role).
   */
  @Get()
  async listReviews(@Query() query: ListHumanReviewsQueryDto) {
    return this.humanReviewsService.listReviews(query);
  }

  /**
   * Retrieves a single Human Review by ID.
   * Gated behind JwtAuthGuard only (accessible to any authenticated role).
   */
  @Get(':id')
  async getReviewById(@Param('id') id: string) {
    return this.humanReviewsService.getReviewById(id);
  }

  /**
   * Resolves a Human Review (APPROVED or REJECTED).
   * STRICTLY GATED behind RolesGuard(ADMIN) and requires mandatory written justification.
   */
  @Post(':id/resolve')
  @Roles(UserRole.ADMIN)
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  async resolveReview(
    @Param('id') id: string,
    @Body() dto: ResolveHumanReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.humanReviewsService.resolveReview(id, dto, user.id);
  }
}
