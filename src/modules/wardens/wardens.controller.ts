import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { apiResponse } from '../../common/utils/api-response.util.js';
import { WardensService } from './wardens.service.js';
import { ListWardensDto, RegisterWardenDto } from './wardens.dto.js';

@ApiTags('wardens')
@Controller('wardens')
export class WardensController {
  constructor(private readonly wardensService: WardensService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register warden — KYC verification runs asynchronously' })
  @ApiResponse({ status: 201, description: 'Warden registered with status PENDING' })
  async register(@Body() dto: RegisterWardenDto) {
    const warden = await this.wardensService.register(dto);
    return apiResponse(warden, HttpStatus.CREATED);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List wardens with optional status/zone filters' })
  async list(@Query() query: ListWardensDto) {
    const result = await this.wardensService.list(query);
    return apiResponse(result);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get warden by ID' })
  @ApiResponse({ status: 404, description: 'Warden not found' })
  async findOne(@Param('id') id: string) {
    const warden = await this.wardensService.findById(id);
    return apiResponse(warden);
  }

  @Patch(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate warden' })
  @ApiResponse({ status: 404, description: 'Warden not found' })
  async deactivate(@Param('id') id: string) {
    const warden = await this.wardensService.deactivate(id);
    return apiResponse(warden);
  }
}
