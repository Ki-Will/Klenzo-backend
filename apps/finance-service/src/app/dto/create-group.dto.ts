import { IsString, IsNotEmpty, IsArray, IsEmail } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsArray()
  @IsEmail({}, { each: true })
  memberEmails: string[];
}
