import { SetMetadata } from '@nestjs/common';
import { PUBLIC_ROUTE_KEY } from '../types/constant.js';

export const Public = () => SetMetadata(PUBLIC_ROUTE_KEY, true);
