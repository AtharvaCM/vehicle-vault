import { Body, Controller, Get, Patch, Param, Delete, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { SubscribePushDto, UnsubscribePushDto } from './dto/push-subscription.dto';
import { NotificationsService } from './notifications.service';
import { PushSubscriptionsService } from './push-subscriptions.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly pushSubscriptions: PushSubscriptionsService,
  ) {}

  @Get('push/public-key')
  getPushPublicKey() {
    return {
      available: this.pushSubscriptions.isConfigured,
      publicKey: this.pushSubscriptions.publicKey,
    };
  }

  @Post('push/subscribe')
  async subscribePush(@CurrentUser('id') userId: string, @Body() body: SubscribePushDto) {
    return this.pushSubscriptions.subscribe(userId, body);
  }

  @Delete('push/subscribe')
  async unsubscribePush(@CurrentUser('id') userId: string, @Body() body: UnsubscribePushDto) {
    return this.pushSubscriptions.unsubscribe(userId, body.endpoint);
  }

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
