import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterRequestDto {
  @ApiProperty({ example: 'client@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'supersecret1' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;
}
