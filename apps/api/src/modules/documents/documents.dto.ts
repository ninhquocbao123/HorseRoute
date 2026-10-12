import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
export class DocumentReviewDto {
 @ApiProperty({enum:['VALID','INVALID']}) @IsIn(['VALID','INVALID']) status:string;
 @ApiProperty({description:'ID phiên bản đang thẩm định'}) @Matches(/^[1-9]\d{0,19}$/) versionId:string;
 @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) reason?:string;
 @ApiPropertyOptional({format:'date'}) @IsOptional() @IsISO8601({strict:true}) @Matches(/^\d{4}-\d{2}-\d{2}$/) expiryDate?:string;
}
export class SupplementDto {
 @ApiProperty() @IsString() @Matches(/\S/) @MaxLength(255) reason:string;
}
export class DossierUpdateDto {
 @ApiProperty({enum:['SUBMITTED','REVIEWING','NEED_INFO','APPROVED','REJECTED']}) @IsIn(['SUBMITTED','REVIEWING','NEED_INFO','APPROVED','REJECTED']) status:string;
 @ApiProperty({format:'date'}) @IsISO8601({strict:true}) @Matches(/^\d{4}-\d{2}-\d{2}$/) date:string;
 @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) receiptCode?:string;
 @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) reason?:string;
}
