import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ListNotificationsQueryDto } from './dto/notification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async listNotifications(@Request() req: any, @Query() query: ListNotificationsQueryDto) {
    const userId = req.user.id;
    return this.notificationsService.listNotifications(userId, query);
  }

  @Get(':id')
  async getNotificationById(@Request() req: any, @Param('id') id: string) {
    const userId = req.user.id;
    return this.notificationsService.getNotificationById(userId, id);
  }

  @Patch(':id/read')
  async markAsRead(@Request() req: any, @Param('id') id: string) {
    const userId = req.user.id;
    return this.notificationsService.markAsRead(userId, id);
  }
}
