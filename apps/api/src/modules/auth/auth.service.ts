import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@my-project/shared';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './auth.dto';
import { User } from '../users/entities/user.entity';
@Injectable()
export class AuthService {
 constructor(private readonly users:UsersService,private readonly jwt:JwtService){}
 private session(user:User){const {passwordHash,...safeUser}=user;return {accessToken:this.jwt.sign({sub:user.id,email:user.email,role:user.role}),user:safeUser};}
 async login(email:string,password:string){
  const user=await this.users.findByEmailWithPassword(email);
  if(!user||user.accountStatus!=='ACTIVE'||!user.passwordHash||!await bcrypt.compare(password,user.passwordHash))throw new UnauthorizedException('Email hoặc mật khẩu không đúng, hoặc tài khoản không hoạt động.');
  return this.session(user);
 }
 async register(dto:RegisterDto){
  if(Buffer.byteLength(dto.password,'utf8')>72)throw new BadRequestException('Mật khẩu không được vượt quá 72 byte UTF-8.');
  const email=dto.email.trim().toLowerCase();
  if(await this.users.findByEmailWithPassword(email))throw new ConflictException('Email đã được sử dụng.');
  const passwordHash=await bcrypt.hash(dto.password,12);
  try{return this.session(await this.users.create({email,passwordHash,fullName:dto.fullName.trim(),phone:dto.phone.trim(),address:dto.address.trim(),role:Role.CUSTOMER,accountStatus:'ACTIVE'}));}
  catch(error){if((error as {code?:string}).code==='ER_DUP_ENTRY')throw new ConflictException('Email đã được sử dụng.');throw error;}
 }
}
