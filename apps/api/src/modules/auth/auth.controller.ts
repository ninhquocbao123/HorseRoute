import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './auth.dto';
import { Public } from '../../common/decorators/public.decorator';
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
 constructor(private readonly auth:AuthService){}
 @Public() @Post('login') @HttpCode(200)
 @ApiOperation({summary:'Đăng nhập bằng email và mật khẩu; trả JWT và thông tin tài khoản'})
 @ApiResponse({status:200,description:'accessToken và user (không có passwordHash)'})
 @ApiResponse({status:401,description:'Sai thông tin hoặc tài khoản không hoạt động'})
 login(@Body() dto:LoginDto){return this.auth.login(dto.email,dto.password);}
 @Public() @Post('register')
 @ApiOperation({summary:'Đăng ký Customer với đầy đủ tên, email, điện thoại, mật khẩu, địa chỉ'})
 @ApiResponse({status:201,description:'Customer đã tạo; trả accessToken và user'})
 @ApiResponse({status:400,description:'Thông tin không hợp lệ; fields chứa lỗi từng trường'})
 @ApiResponse({status:409,description:'Email đã được sử dụng'})
 register(@Body() dto:RegisterDto){return this.auth.register(dto);}
}
