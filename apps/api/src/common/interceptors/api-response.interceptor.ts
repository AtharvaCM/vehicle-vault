import {
  Injectable,
  StreamableFile,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Readable } from 'node:stream';
import { map, type Observable } from 'rxjs';

import { isSuccessResponse, successResponse } from '../utils/api-response.util';

/**
 * Returns true for response values that must NOT be wrapped in the
 * `{ success, data }` envelope — binary streams, file downloads, raw
 * buffers. Wrapping any of these JSON-serializes the bytes and breaks
 * the response (PDF / image / zip becomes `{"type":"Buffer","data":[…]}`).
 */
function isRawResponse(value: unknown): boolean {
  return (
    value instanceof StreamableFile ||
    value instanceof Readable ||
    Buffer.isBuffer(value) ||
    value instanceof Uint8Array ||
    value instanceof ArrayBuffer
  );
}

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((value) => {
        if (isRawResponse(value)) {
          return value;
        }
        if (isSuccessResponse(value)) {
          return value;
        }

        return successResponse(value);
      }),
    );
  }
}
