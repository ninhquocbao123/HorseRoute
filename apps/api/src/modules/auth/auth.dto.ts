import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
const trim=({value}:{value:unknown})=>typeof value==='string'?value.trim():value;
export class LoginDto {
 @ApiProperty({example:'customer@example.com',maxLength:100})
 @Transform(({value})=>typeof value==='string'?value.trim().toLowerCase():value) @IsEmail() @MaxLength(100) email:string;
 @ApiProperty({format:'password',writeOnly:true,maxLength:72})
 @IsString() @Length(1,72) password:string;
}
export class RegisterDto extends LoginDto {
 @ApiProperty({minLength:8,maxLength:72,format:'password',writeOnly:true})
 @IsString() @Length(8,72,{message:'Mật khẩu cần từ 8 đến 72 ký tự.'}) @Matches(/\S/,{message:'Mật khẩu không được chỉ gồm khoảng trắng.'}) password:string;
 @ApiProperty({example:'Nguyễn Văn An',minLength:2,maxLength:100})
 @Transform(trim) @IsString() @Length(2,100,{message:'Nhập họ tên từ 2 đến 100 ký tự.'}) fullName:string;
 @ApiProperty({example:'0901234567',pattern:'^\\+?[0-9]{9,15}$'})
 @Transform(trim) @IsString() @Matches(/^\+?[0-9]{9,15}$/,{message:'Số điện thoại cần 9–15 chữ số, có thể bắt đầu bằng +.'}) phone:string;
 @ApiProperty({example:'123 Nguyễn Huệ, Quận 1, TP.HCM',minLength:5,maxLength:255})
 @Transform(trim) @IsString() @Length(5,255,{message:'Nhập địa chỉ nhà từ 5 đến 255 ký tự.'}) address:string;
}
