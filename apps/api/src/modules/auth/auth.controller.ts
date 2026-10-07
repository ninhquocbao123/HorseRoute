import { Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('sync')
  sync(@CurrentUser() user: { uid: string; email?: string; name?: string }) {
    return this.auth.sync(user);
  }
}
