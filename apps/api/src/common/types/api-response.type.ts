export type ApiSuccessResponse<TData, TMeta = unknown> = {
  success: true;
  data: TData;
  meta?: TMeta;
};

export type ApiErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: {
    path: string;
    timestamp: string;
  };
};
