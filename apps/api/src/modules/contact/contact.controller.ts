import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/auth/decorators/public.decorator';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import { successResponse } from '../../common/utils/api-response.util';
import { ContactService } from './contact.service';
import { ContactMessageDto } from './dto/contact-message.dto';

@ApiTags('Contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Public()
  @RateLimit('mail')
  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Send a message from the public Contact page' })
  async send(@Body() body: ContactMessageDto) {
    return successResponse(await this.contactService.receive(body));
  }
}
