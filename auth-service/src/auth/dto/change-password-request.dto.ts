import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordRequestDto {
  @ApiProperty({ example: 'oldpassword1' })
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({ example: 'newpassword1' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  newPassword!: string;
}
