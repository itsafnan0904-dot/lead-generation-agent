import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ConversationsService } from './conversations.service';
import { ListConversationsQueryDto, SyncGmailQueryDto } from './dto/conversation.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  /**
   * Manual Gmail sync trigger (Step 1).
   * Pulls new messages from Gmail, creates/maps conversations and messages idempotently,
   * runs lead matching, AI reply analysis, restriction re-checking, and lifecycle progression.
   */
  @Post('gmail/sync')
  @HttpCode(HttpStatus.OK)
  async syncGmailInbox(@Query() query: SyncGmailQueryDto) {
    return this.conversationsService.syncGmailInbox(query);
  }

  /**
   * Lists conversations with filtering (e.g. ?status=UNASSIGNED for human assignment dashboard).
   */
  @Get('conversations')
  async listConversations(@Query() query: ListConversationsQueryDto) {
    return this.conversationsService.listConversations(query);
  }

  /**
   * Retrieves a single conversation by ID with all messages, AI metadata, and lead context.
   */
  @Get('conversations/:id')
  async getConversationById(@Param('id') id: string) {
    return this.conversationsService.getConversationById(id);
  }
}
