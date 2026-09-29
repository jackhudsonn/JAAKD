import { ApiProperty } from '@nestjs/swagger';

export class RegisterResponseDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ example: 'client@example.com' })
  email!: string;

  @ApiProperty({ example: true })
  registered!: boolean;
}
