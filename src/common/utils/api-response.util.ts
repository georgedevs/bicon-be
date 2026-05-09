import { HttpStatus } from '@nestjs/common';

export const apiResponse = <T>(
  payload: T,
  statusCode: number = HttpStatus.OK,
  errors?: unknown,
) => ({
  status: statusCode >= 400 ? 'error' : 'success',
  statusCode,
  [statusCode >= 400 ? 'message' : 'data']: payload,
  ...(errors ? { errors } : {}),
});
