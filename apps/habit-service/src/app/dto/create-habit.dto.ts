import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateHabitDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  frequency: string;
}
