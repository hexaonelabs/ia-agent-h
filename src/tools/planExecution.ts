interface PlanExecutionArgs {
  timestamp: number;
  prompt: string;
}
export const planExecution = async (args: PlanExecutionArgs) => {
  const { timestamp, prompt } = args;
  return {
    plan_execution: {
      timestamp,
      prompt,
    },
  };
};
