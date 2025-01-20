interface PlanExecutionArgs {
  timestamp: number;
  prompt: string;
}
export const planExecution = async (
  args: PlanExecutionArgs,
  taskScheduler: {
    addTask: (timestamp: number, prompt: string) => Promise<void>;
  },
) => {
  const { timestamp, prompt } = args;
  await taskScheduler.addTask(timestamp, prompt);
  return 'Planned';
};
