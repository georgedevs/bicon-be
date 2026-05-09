import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { apiResponse } from '../../common/utils/api-response.util.js';
import { IncidentsService } from './incidents.service.js';
import { ListIncidentsDto } from './incidents.dto.js';

@ApiTags('incidents')
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List incidents with optional filters and pagination',
  })
  async list(@Query() query: ListIncidentsDto) {
    const result = await this.incidentsService.list(query);
    return apiResponse(result);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get full incident detail' })
  @ApiResponse({ status: 404, description: 'Incident not found' })
  async findOne(@Param('id') id: string) {
    const incident = await this.incidentsService.findById(id);
    return apiResponse(incident);
  }

  @Post(':id/dispatch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Dispatch incident — marks as DISPATCHED and emits WebSocket event',
  })
  @ApiResponse({
    status: 409,
    description: 'Incident not in a dispatchable status',
  })
  @ApiResponse({ status: 404, description: 'Incident not found' })
  async dispatch(@Param('id') id: string) {
    const incident = await this.incidentsService.dispatch(id);
    return apiResponse(incident);
  }

  @Post(':id/dismiss')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Dismiss incident — marks as DISMISSED and emits WebSocket event',
  })
  @ApiResponse({
    status: 409,
    description: 'Incident not in a dismissible status',
  })
  @ApiResponse({ status: 404, description: 'Incident not found' })
  async dismiss(@Param('id') id: string) {
    const incident = await this.incidentsService.dismiss(id);
    return apiResponse(incident);
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve incident — must be DISPATCHED first' })
  @ApiResponse({ status: 409, description: 'Incident is not DISPATCHED' })
  @ApiResponse({ status: 404, description: 'Incident not found' })
  async resolve(@Param('id') id: string) {
    const incident = await this.incidentsService.resolve(id);
    return apiResponse(incident);
  }
}

