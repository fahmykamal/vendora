import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentIdentity } from '../identity/auth.guard.js';
import type { Identity } from '../identity/auth.guard.js';
import { VendorsService } from './vendors.service.js';
import { VendorNameDto } from './vendor.dto.js';

@ApiTags('vendors')
@ApiBearerAuth()
@Controller('vendors')
export class VendorsController {
  constructor(
    @Inject(VendorsService) private readonly vendors: VendorsService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create a vendor, owner membership, and initial branch atomically',
  })
  create(@CurrentIdentity() identity: Identity, @Body() input: VendorNameDto) {
    return this.vendors.create(identity.user.id, input.name);
  }

  @Get()
  @ApiOperation({ summary: 'List only vendors the signed-in user belongs to' })
  list(@CurrentIdentity() identity: Identity) {
    return this.vendors.list(identity.user.id);
  }

  @Get(':vendorId')
  get(
    @CurrentIdentity() identity: Identity,
    @Param('vendorId', new ParseUUIDPipe()) vendorId: string,
  ) {
    return this.vendors.get(identity.user.id, vendorId);
  }

  @Patch(':vendorId')
  @ApiOperation({ summary: 'Rename a vendor as its owner or manager' })
  rename(
    @CurrentIdentity() identity: Identity,
    @Param('vendorId', new ParseUUIDPipe()) vendorId: string,
    @Body() input: VendorNameDto,
  ) {
    return this.vendors.rename(identity.user.id, vendorId, input.name);
  }
}
