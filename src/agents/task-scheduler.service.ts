import { Injectable } from '@nestjs/common';

@Injectable()
export class TaskSchedulerService {
  private tasks: { timestamp: number; prompt: string }[] = [];

  addTask(timestamp: number, prompt: string) {
    this.tasks.push({ timestamp, prompt });
    console.log(`Planned task: ${timestamp}: ${prompt}`);
  }

  runTasks() {
    const now = Math.floor(Date.now() / 1000); // Timestamp actuel en secondes
    this.tasks.forEach((task) => {
      if (task.timestamp <= now) {
        console.log(`Task Execution: ${task.prompt}`);
        // logique de votre code
      }
    });
  }
}
