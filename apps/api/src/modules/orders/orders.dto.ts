import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsISO8601, IsOptional, IsString, IsUUID, Length, Matches, MaxLength, ValidateNested } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
const trim = ({value}: {value: unknown}) => typeof value === 'string' ? value.trim() : value;
export class HorseDto {
  @ApiPropertyOptional({ type: () => String })
  @IsOptional() @Matches(/^[1-9]\d{0,19}$/) id?: string;
  @ApiProperty({ type: () => String })
  @Transform(trim) @IsString() @Length(1,100,{message:'Nhập tên ngựa (tối đa 100 ký tự).'}) name: string;
  @ApiProperty({ type: () => String })
  @Transform(trim) @IsString() @Length(1,50,{message:'Nhập định danh ngựa (tối đa 50 ký tự).'}) passportNo: string;
  @ApiPropertyOptional({ type: () => String })
  @IsOptional() @IsString() @MaxLength(50) breed?: string;
  @ApiPropertyOptional({ type: () => String })
  @IsOptional() @IsISO8601({strict:true}) @Matches(/^\d{4}-\d{2}-\d{2}$/) birthDate?: string;
  @ApiPropertyOptional({ type: () => String })
  @IsOptional() @IsString() @MaxLength(10) sex?: string;
  @ApiPropertyOptional({ type: () => String })
  @IsOptional() @IsString() @MaxLength(30) coatColor?: string;
  @ApiPropertyOptional({ type: () => String })
  @IsOptional() @IsString() @MaxLength(255) note?: string;
}
export class DraftHorseDto {
  @ApiPropertyOptional({ type: () => String })
  @IsOptional() @Matches(/^[1-9]\d{0,19}$/) id?: string;
  @ApiPropertyOptional({ type: () => String })
  @IsOptional() @IsString() @MaxLength(100) name?: string;
  @ApiPropertyOptional({ type: () => String })
  @IsOptional() @IsString() @MaxLength(50) passportNo?: string;
  @ApiPropertyOptional({ type: () => String })
  @IsOptional() @IsString() @MaxLength(50) breed?: string;
  @ApiPropertyOptional({ type: () => String })
  @IsOptional() @IsString() @MaxLength(10) birthDate?: string;
  @ApiPropertyOptional({ type: () => String })
  @IsOptional() @IsString() @MaxLength(10) sex?: string;
  @ApiPropertyOptional({ type: () => String })
  @IsOptional() @IsString() @MaxLength(30) coatColor?: string;
  @ApiPropertyOptional({ type: () => String })
  @IsOptional() @IsString() @MaxLength(255) note?: string;
}
export class DraftOrderDto {
  @ApiPropertyOptional({ type: () => String })
  @IsOptional() @IsUUID() requestId?: string;
  @ApiPropertyOptional({ type: () => String })
  @IsOptional() @IsString() @MaxLength(255) originAddress?: string;
  @ApiPropertyOptional({ type: () => String })
  @IsOptional() @IsString() @MaxLength(2) originCountry?: string;
  @ApiPropertyOptional({ type: () => String })
  @IsOptional() @IsString() @MaxLength(255) destinationAddress?: string;
  @ApiPropertyOptional({ type: () => String })
  @IsOptional() @IsString() @MaxLength(2) destinationCountry?: string;
  @ApiPropertyOptional({ type: () => String })
  @IsOptional() @IsString() @MaxLength(10) desiredDepartureDate?: string;
  @ApiPropertyOptional({ type: () => String })
  @IsOptional() @IsString() @MaxLength(5000) specialRequirements?: string;
  @ApiProperty({ type: () => [DraftHorseDto] })
  @IsArray() @ArrayMaxSize(50) @ValidateNested({each:true}) @Type(()=>DraftHorseDto) horses: DraftHorseDto[];
}
export class OrderDto {
  @ApiProperty({ type: () => String })
  @Transform(trim) @IsString() @Length(1,255,{message:'Nhập địa chỉ đi.'}) originAddress: string;
  @ApiProperty({ type: () => String })
  @Matches(/^[A-Z]{2}$/, {message:'Nhập mã quốc gia gồm 2 chữ cái in hoa.'}) originCountry: string;
  @ApiProperty({ type: () => String })
  @Transform(trim) @IsString() @Length(1,255,{message:'Nhập địa chỉ đến.'}) destinationAddress: string;
  @ApiProperty({ type: () => String })
  @Matches(/^[A-Z]{2}$/, {message:'Nhập mã quốc gia gồm 2 chữ cái in hoa.'}) destinationCountry: string;
  @ApiProperty({ type: () => String })
  @IsISO8601({strict:true},{message:'Ngày khởi hành không hợp lệ.'}) @Matches(/^\d{4}-\d{2}-\d{2}$/) desiredDepartureDate: string;
  @ApiPropertyOptional({ type: () => String })
  @IsOptional() @IsString() @MaxLength(5000) specialRequirements?: string;
  @ApiProperty({ type: () => [HorseDto] })
  @IsArray() @ArrayMinSize(1,{message:'Cần ít nhất một ngựa.'}) @ArrayMaxSize(50) @ValidateNested({each:true}) @Type(()=>HorseDto) horses: HorseDto[];
}
export class ReviewDto {
  @ApiProperty({ type: () => String })
  @IsIn(['APPROVED','REJECTED','NEED_INFO']) decision: string;
  @ApiPropertyOptional({ type: () => String })
  @IsOptional() @IsString() @MaxLength(2000) reason?: string;
  @ApiPropertyOptional({ type: () => String })
  @IsOptional() @Matches(/^[1-9]\d{0,19}$/) coordinatorId?: string;
  @ApiPropertyOptional({ type: () => [String] })
  @IsOptional() @IsArray() @ArrayMaxSize(30) @Matches(/^[1-9]\d{0,19}$/, {each:true}) ruleIds?: string[];
}
export class OrderQueryDto extends PaginationDto {
  @ApiPropertyOptional({ type: () => String })
  @IsOptional() @IsIn(['DRAFT','PENDING','NEED_INFO','REJECTED','APPROVED','PREPARING','READY','IN_TRANSIT','DELIVERED','CANCELLED']) status?: string;
  @ApiPropertyOptional({ type: () => String })
  @IsOptional() @IsString() @MaxLength(50) search?: string;
}
