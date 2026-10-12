import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { Role } from '@my-project/shared';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { User } from '../users/entities/user.entity';
import { DraftOrderDto, OrderQueryDto, ReviewDto } from './orders.dto';
import { OrdersService } from './orders.service';
type AccountRequest = { account: User };
function id(value: string) { if (!/^[1-9]\d{0,19}$/.test(value)) throw new BadRequestException('ID không hợp lệ'); return value; }
@ApiTags('Flow 1 - Orders')
@ApiBearerAuth()
@ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
@ApiResponse({ status: 403, description: 'Không có quyền thực hiện' })
@ApiResponse({ status: 409, description: 'Trạng thái đơn không cho phép thao tác' })
@Controller('orders')
@UseGuards(RolesGuard)
export class OrdersController {
  constructor(private readonly service: OrdersService) {}
  @Get() @Roles(Role.CUSTOMER, Role.MANAGER)
  @ApiOperation({ summary: 'Danh sách đơn: Customer chỉ xem đơn của mình, Manager xem tất cả' })
  list(@Req() r: AccountRequest, @Query() p: OrderQueryDto) { return this.service.list(r.account, p); }
  @Get(':id/review-options') @Roles(Role.MANAGER)
  @ApiOperation({ summary: 'Manager: danh sách điều phối viên và quy định phù hợp' })
  options(@Req() r: AccountRequest, @Param('id') key: string) { return this.service.reviewOptions(r.account, id(key)); }
  @Get(':id') @Roles(Role.CUSTOMER, Role.MANAGER)
  @ApiOperation({ summary: 'Chi tiết đơn, ngựa, giấy tờ và lịch sử' })
  detail(@Req() r: AccountRequest, @Param('id') key: string) { return this.service.detail(r.account, id(key)); }
  @Post() @Roles(Role.CUSTOMER)
  @ApiOperation({ summary: 'Customer: tạo nháp, requestId chống tạo trùng' })
  create(@Req() r: AccountRequest, @Body() dto: DraftOrderDto) { return this.service.save(r.account, dto); }
  @Put(':id') @Roles(Role.CUSTOMER)
  @ApiOperation({ summary: 'Customer: sửa đơn DRAFT hoặc NEED_INFO' })
  edit(@Req() r: AccountRequest, @Param('id') key: string, @Body() dto: DraftOrderDto) { return this.service.save(r.account, dto, id(key)); }
  @Post(':id/submit') @Roles(Role.CUSTOMER)
  @ApiOperation({ summary: 'Customer: gửi đơn hoàn chỉnh sang PENDING' })
  submit(@Req() r: AccountRequest, @Param('id') key: string) { return this.service.submit(r.account, id(key)); }
  @Post(':id/review') @Roles(Role.MANAGER)
  @ApiOperation({ summary: 'Manager: APPROVED, NEED_INFO hoặc REJECTED; duyệt tạo checklist và chuyến nháp' })
  review(@Req() r: AccountRequest, @Param('id') key: string, @Body() dto: ReviewDto) { return this.service.review(r.account, id(key), dto); }
}

