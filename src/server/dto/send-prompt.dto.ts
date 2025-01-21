import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SendPromptDto {
  @ApiProperty({
    example: '1',
    description: 'The thread ID to send the prompt to',
    required: false,
  })
  @IsString()
  @IsOptional()
  readonly threadId?: string;

  @ApiProperty({
    example: 'What is your wallet address?',
    description: 'The user input to send to the agent',
    required: true,
  })
  @IsString()
  readonly userInput: string;
}
