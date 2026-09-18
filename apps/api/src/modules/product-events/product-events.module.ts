import { Global, Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { ProductEventsService } from './product-events.service';

/**
 * Global because the events are written from half a dozen feature modules, each
 * inside its own transaction; importing this into every one of them would say
 * nothing the constructor does not.
 */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [ProductEventsService],
  exports: [ProductEventsService],
})
export class ProductEventsModule {}
