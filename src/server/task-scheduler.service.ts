import { Injectable } from '@nestjs/common';
import { CustomLogger } from '../logger.service';
import { SendPromptDto } from '../server/dto/send-prompt.dto';
import { SseSubjectService } from './sse-subject.service';
import { v4 as uuid } from 'uuid';

@Injectable()
export class TaskSchedulerService {
  private tasks: {
    timestamp: number;
    prompt: string;
    userAddress: string;
    processId?: string;
  }[] = [];
  private readonly _logger = new CustomLogger(TaskSchedulerService.name);
  private _sendPromptFn: (
    params: SendPromptDto,
    userAddress: string,
  ) => Promise<{
    threadId: string;
    message: string;
  }>;
  constructor(private _sseSubjectService: SseSubjectService) {}

  setExecuter(
    fn: (
      params: SendPromptDto,
      userAddress: string,
    ) => Promise<{ threadId: string; message: string }>,
  ) {
    this._sendPromptFn = fn;
    this._runTasks();
    // Run tasks every 15 seconds
    setInterval(() => {
      this._runTasks();
    }, 15000);
    this._logger.log(
      `🚀 Task Scheduler Service is ready and looking to execute task every 15000ms`,
    );
  }

  addTask(timestamp: number, prompt: string, userAddress: string) {
    this.tasks.push({ timestamp, prompt, userAddress });
    this._logger.log(`🕒 Planned task: ${timestamp}: ${prompt}`);
  }

  private _runTasks() {
    const now = Math.floor(Date.now() / 1000); // Timestamp actuel en secondes
    this.tasks.forEach(async (task, index) => {
      if (task.timestamp <= now && !task.processId) {
        this._logger.log(`🚀 Task Execution: ${task.prompt}`);
        // add processId to prevent multiple execution
        task.processId = uuid();
        // execute task
        const result = await this._sendPromptFn(
          {
            userInput: task.prompt,
          },
          task.userAddress,
        );
        // dispatch result to SSE
        this._sseSubjectService.sendEventToUser(task.userAddress, {
          data: { chat: result },
        } as MessageEvent);
        this._logger.log(
          `✅ Scheduled task of user ${task.userAddress} executed with success: ${task.prompt}`,
        );
        // remove task from queue
        this.tasks.splice(index, 1);
      }
    });
  }
}
