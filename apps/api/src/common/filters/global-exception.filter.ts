import {
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
} from '@nestjs/common';

import type { ApiErrorResponse } from '../types/api-response.type';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<{
      status: (code: number) => {
        json: (body: ApiErrorResponse) => void;
      };
    }>();
    const request = context.getRequest<{ url: string }>();
    const timestamp = new Date().toISOString();

    const normalized = this.normalizeException(exception);
    const payload: ApiErrorResponse = {
      success: false,
      error: normalized.error,
      meta: {
        path: request.url,
        timestamp,
      },
    };

    if (normalized.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(normalized.error.message, normalized.stack);
    }

    response.status(normalized.status).json(payload);
  }

  private normalizeException(exception: unknown) {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'string') {
        return {
          status,
          error: {
            code: this.getErrorCode(status),
            message: response,
          },
          stack: exception.stack,
        };
      }

      const responseBody = response as {
        details?: unknown;
        error?: string;
        message?: string | string[];
      };
      const rawMessage = responseBody.message ?? exception.message;
      const message = Array.isArray(rawMessage) ? 'Validation failed' : rawMessage;
      const details = Array.isArray(rawMessage)
        ? rawMessage
        : responseBody.details
          ? responseBody.details
          : undefined;

      return {
        status,
        error: {
          code: this.getErrorCode(status),
          message,
          ...(details !== undefined ? { details } : {}),
        },
        stack: exception.stack,
      };
    }

    if (exception instanceof Error && exception.name === 'MulterError') {
      const multerException = exception as Error & { code?: string };
      const message =
        multerException.code === 'LIMIT_FILE_SIZE'
          ? 'Each file must be 5 MB or smaller.'
          : multerException.code === 'LIMIT_FILE_COUNT'
            ? 'You can upload up to 10 files at a time.'
            : multerException.code === 'LIMIT_UNEXPECTED_FILE'
              ? 'Attachment uploads must use the expected file field.'
              : exception.message;

      return {
        status: HttpStatus.BAD_REQUEST,
        error: {
          code: 'BAD_REQUEST',
          message,
        },
        stack: exception.stack,
      };
    }

    const fallbackMessage =
      exception instanceof Error ? exception.message : 'An unexpected error occurred';

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: fallbackMessage,
      },
      stack: exception instanceof Error ? exception.stack : undefined,
    };
  }

  private getErrorCode(status: number) {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      default:
        return status >= HttpStatus.INTERNAL_SERVER_ERROR ? 'INTERNAL_SERVER_ERROR' : 'ERROR';
    }
  }
}
