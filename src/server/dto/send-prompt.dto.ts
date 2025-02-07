import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

class VercelMessageDto {
  @ApiProperty({
    example: `user | system`,
    description: 'The role of the message sender',
    required: true,
  })
  @IsString()
  role: string;

  @ApiProperty({
    example: `Hello, how are you?`,
    description: 'The message content',
    required: true,
  })
  @IsString()
  content: string;
}

export class SendPromptDto {
  @ApiProperty({
    example: `[
      {
        role: 'user',
        content: 'Hello, how are you?',
      },
    ]`,
    description: 'The messages to send to the AI model',
    required: false,
  })
  @IsArray()
  messages: VercelMessageDto[];
}
