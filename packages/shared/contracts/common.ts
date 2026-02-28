export type AccountType = 'learner' | 'parent' | 'admin';

export type ApiSuccessResponse<TData> = {
  data: TData;
};

export type ApiErrorResponse = {
  code: string;
  message: string;
  details?: Record<string, string[]>;
  requestId?: string;
};
