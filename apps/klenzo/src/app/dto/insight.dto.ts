import { IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class TrendsQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(7)
  @Max(365)
  @Type(() => Number)
  days?: number;
}

export class AnalyticsQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  @Type(() => Number)
  days?: number;
}