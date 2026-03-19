export class ApiError<TData = unknown> extends Error {
  readonly status: number;
  readonly data: TData | null;

  constructor(message: string, status: number, data: TData | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}
