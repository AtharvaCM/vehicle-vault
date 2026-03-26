import { Controller, Get, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async findAll(@CurrentUser('id') userId: string) {
    const notifications = await this.notificationsService.findAll(userId);
    const unreadCount = await this.notificationsService.getUnreadCount(userId);
    return { notifications, unreadCount };
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser('id') userId: string) {
    return { count: await this.notificationsService.getUnreadCount(userId) };
  }

  @Patch(':id/read')
  async markAsRead(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.notificationsService.markAsRead(userId, id);
  }

  @Patch('read-all')
  async markAllAsRead(@CurrentUser('id') userId: string) {
    await this.notificationsService.markAllAsRead(userId);
    return { success: true };
  }

  @Delete(':id')
  async delete(@CurrentUser('id') userId: string, @Param('id') id: string) {
    await this.notificationsService.delete(userId, id);
    return { success: true };
  }
}
