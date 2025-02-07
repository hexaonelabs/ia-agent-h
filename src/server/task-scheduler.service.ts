import { HttpStatus, Injectable } from '@nestjs/common';
import { CustomLogger } from '../logger.service';
import { SendPromptDto } from '../server/dto/send-prompt.dto';
import { SseSubjectService } from './sse-subject.service';
import { v4 as uuid } from 'uuid';
import { getGoogleEvents } from '../tools/getGoogleEvents';

@Injectable()
export class TaskSchedulerService {
  private tasks: {
    id: string;
    timestamp: number;
    prompt: string;
    userAddress: string;
    processId?: string;
  }[] = [];
  private readonly _logger = new CustomLogger(TaskSchedulerService.name);
  private _sendPromptFn: (
    params: SendPromptDto & { userAddress: string },
  ) => Promise<{
    statusCode: HttpStatus;
    message: string;
    data: {
      answer: string;
      chat_history: any[];
    };
  }>;
  private _lastLoadTimestamp = 0;
  private _intervalId: NodeJS.Timeout | null = null;
  constructor(private _sseSubjectService: SseSubjectService) {}

  setExecuter(
    fn: (params: SendPromptDto & { userAddress: string }) => Promise<{
      statusCode: HttpStatus;
      message: string;
      data: {
        answer: string;
        chat_history: any[];
      };
    }>,
  ) {
    this._sendPromptFn = fn;
    this._logger.log(
      `🚀 Task Scheduler Service is ready and looking to execute task every 15000ms`,
    );
    this._init();
  }

  addTask(
    timestamp: number,
    prompt: string,
    userAddress: string,
    id: string = uuid(),
  ) {
    this.tasks.push({ timestamp, prompt, userAddress, id });
    this._logger.log(`🕒 Planned task ${id}: ${timestamp}: ${prompt}`);
  }

  stop() {
    if (this._intervalId) {
      clearTimeout(this._intervalId);
      this._intervalId = null;
    }
  }

  private async _init() {
    await this._loadTasks();
    this._runTasks();
    this._scheduleNextRun();
  }

  private _scheduleNextRun() {
    this._intervalId = setTimeout(async () => {
      await this._loadTasks();
      this._runTasks();
      this._scheduleNextRun();
    }, 14900);
  }

  private _runTasks() {
    const now = Math.floor(Date.now() / 1000); // Timestamp actuel en secondes
    this.tasks.forEach(async (task, index) => {
      if (task.timestamp <= now && !task.processId) {
        this._logger.log(`🚀 Task Execution: ${task.prompt}`);
        // add processId to prevent multiple execution
        task.processId = uuid();
        // execute task
        const result = await this._sendPromptFn({
          messages: [
            {
              role: 'user',
              content: task.prompt,
            },
          ],
          userAddress: task.userAddress,
        });
        // dispatch result to SSE
        this._sseSubjectService.sendEventToUser(task.userAddress, {
          data: { chat: result },
        } as MessageEvent);
        this._logger.log(
          `✅ Scheduled task ${task.id} of user ${task.userAddress} executed with success: ${task.prompt}`,
        );
        // remove task from queue
        this.tasks.splice(index, 1);
      }
    });
  }

  private async _loadTasks() {
    // load every hours
    if (this._lastLoadTimestamp + 1000 * 60 * 60 > Date.now()) {
      return;
    }
    this._logger.log(`🔄 Loading tasks from Google Calendar`);
    // update last load timestamp before loading to prevent multiple loading
    this._lastLoadTimestamp = Date.now();
    // load task from calendar google events
    const events = await getGoogleEvents({
      startDate: new Date(),
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
    });
    // exclude event that already added in queue
    const eventsToExclude = this.tasks.map((task) => task.id);
    const eventsList = events.filter(
      (event) => !eventsToExclude.includes(event.created),
    );
    this._logger.log(
      `📅 ${eventsList.length} events loaded from Google Calendar`,
    );
    // calculate timestamp events
    eventsList.forEach(async (event) => {
      this.addTask(
        Date.parse(event.start as string) / 1000,
        `${event.summary} - ${event.description || ''}`,
        '0x0',
        event.created,
      );
    });
  }
}
