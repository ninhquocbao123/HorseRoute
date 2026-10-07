import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@my-project/shared';
import { UsersService } from './users.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: { uid: string }) {
    return this.users.getByFirebaseUid(user.uid);
  }

  @Get()
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  findAll(@Query() query: PaginationDto) {
    return this.users.findAll(query);
  }
}
