import { ApiProperty } from '@nestjs/swagger';

export class PromptAPIResponse {
  @ApiProperty({
    example: true,
    description: 'The success status of the request',
  })
  success: boolean;

  @ApiProperty({
    example: {
      threadId: '123',
      message: 'Hello',
    },
    description: 'The data returned by the request',
  })
  data:
    | {
        threadId: string;
        message: string;
      }
    | string;
}
