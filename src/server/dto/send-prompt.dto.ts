import { IsOptional, IsString } from 'class-validator';

export class SendPromptDto {
  @IsString()
  @IsOptional()
  readonly threadId?: string;

  @IsString()
  readonly userInput: string;
}
