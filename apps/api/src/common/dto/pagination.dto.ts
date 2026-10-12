import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  @ApiPropertyOptional({ type: () => Number })
  page: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  @ApiPropertyOptional({ type: () => Number })
  limit: number = 20;
}

