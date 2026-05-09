import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { apiResponse } from '../../common/utils/api-response.util.js';
import { ZonesService } from './zones.service.js';
import { CreateZoneDto, UpdateZoneDto } from './zones.dto.js';

@ApiTags('zones')
@Controller('zones')
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a zone and register Nokia geofence subscription' })
  @ApiResponse({ status: 201, description: 'Zone created' })
  async create(@Body() dto: CreateZoneDto) {
    const zone = await this.zonesService.create(dto);
    return apiResponse(zone, HttpStatus.CREATED);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all zones' })
  async findAll() {
    const zones = await this.zonesService.findAll();
    return apiResponse(zones);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get zone by ID' })
  @ApiResponse({ status: 404, description: 'Zone not found' })
  async findOne(@Param('id') id: string) {
    const zone = await this.zonesService.findById(id);
    return apiResponse(zone);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update zone name or active status' })
  @ApiResponse({ status: 404, description: 'Zone not found' })
  async update(@Param('id') id: string, @Body() dto: UpdateZoneDto) {
    const zone = await this.zonesService.update(id, dto);
    return apiResponse(zone);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete zone and cancel Nokia geofence subscription' })
  @ApiResponse({ status: 204, description: 'Zone deleted' })
  @ApiResponse({ status: 404, description: 'Zone not found' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.zonesService.delete(id);
  }
}
