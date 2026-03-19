import { Injectable } from '@nestjs/common';

@Injectable()
export class AttachmentsService {
  getPlaceholderStatus() {
    return {
      status: 'not-implemented',
      message: 'Attachments will be added once document storage requirements are finalized.',
    };
  }
}
