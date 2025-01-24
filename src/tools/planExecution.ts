interface PlanExecutionArgs {
  timestamp: number;
  prompt: string;
}
export const planExecution = async (
  args: PlanExecutionArgs,
  taskScheduler: {
    addTask: (
      timestamp: number,
      prompt: string,
      userAddress: string,
    ) => Promise<void>;
  },
  userAddress: string,
) => {
  const { timestamp, prompt } = args;
  await taskScheduler.addTask(timestamp, prompt, userAddress);
  return 'Planned';
};
