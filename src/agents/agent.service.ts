import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { Thread } from 'openai/resources/beta/threads/threads';
import { Assistant } from 'openai/resources/beta/assistants';
import { Run } from 'openai/resources/beta/threads/runs/runs';
import { tools } from '../tools/index.js';
import { assistantPrompt } from '../const/prompt.js';
import { parse } from 'marked';
import { XAgentService } from './x-agent.service.js';

@Injectable()
export class AgentService {
  private readonly _client: OpenAI;
  private _assistant: Assistant;
  public readonly threads: Thread[] = [];
  private readonly inMemoryThreadsMesssages: Record<string, string[]> = {};
  constructor() {
    this._client = new OpenAI();
    this._createAssistant(this._client).then((assistant) => {
      this._assistant = assistant;
    });
    this._manageAgents();
  }

  async createThread() {
    if (!this._assistant) {
      this._assistant = await this._createAssistant(this._client);
    }
    try {
      const thread = await this._createThread(this._client);
      this.threads.push(thread);
      return thread;
    } catch (error) {
      throw new Error(
        `Error creating thread: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async sendMessage(params: { threadId?: string; userInput: string }) {
    const { threadId, userInput } = params;
    // find the thread by id or create a new one
    const thread = !threadId
      ? await this.createThread()
      : this.threads.find((thread) => thread.id === threadId);
    if (!thread) {
      throw new Error('Thread not found');
    }
    if (!this._assistant) {
      this._assistant = await this._createAssistant(this._client);
    }
    try {
      // Add the user's message to the thread
      await this._client.beta.threads.messages.create(thread.id, {
        role: 'user',
        content: userInput,
      });
      // Create and perform the run
      const run = await this._createRun(thread);
      const result = await this._performRun(run, thread);
      const response =
        result?.type === 'text' ? result.text.value : 'No text response';
      // Add the response to the in-memory store
      if (!this.inMemoryThreadsMesssages[thread.id]) {
        this.inMemoryThreadsMesssages[thread.id] = [];
      }
      this.inMemoryThreadsMesssages[thread.id].push(userInput);
      // finally return the response
      return {
        threadId: thread.id,
        message: await parse(response),
      };
    } catch (error) {
      const message = `Error during chat: ${error instanceof Error ? error.message : 'Unknown error'}`;
      throw new Error(message);
    }
  }

  private async _createAssistant(
    client: OpenAI,
    name = 'AgentH',
    instructions = assistantPrompt,
    toolsAvailable = Object.values(tools).map((tool) => tool.definition),
  ): Promise<Assistant> {
    return await client.beta.assistants.create({
      model: 'gpt-4o-mini',
      name,
      instructions,
      tools: toolsAvailable,
    });
  }

  private async _createThread(
    client: OpenAI,
    message?: string,
  ): Promise<Thread> {
    const thread = await client.beta.threads.create();

    if (message) {
      await client.beta.threads.messages.create(thread.id, {
        role: 'user',
        content: message,
      });
    }

    return thread;
  }

  private async _createRun(thread: Thread): Promise<Run> {
    const assistantId = this._assistant.id;
    console.log(
      `🚀 Creating run for thread ${thread.id} with assistant ${assistantId}`,
    );
    let run = await this._client.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId,
    });
    // Wait for the run to complete and keep polling
    while (run.status === 'in_progress' || run.status === 'queued') {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
      run = await this._client.beta.threads.runs.retrieve(thread.id, run.id);
    }
    return run;
  }

  private async _performRun(run: Run, thread: Thread) {
    console.log(`🚀 Performing run ${run.id}`);
    // execute action to call if status is requires_action
    while (run.status === 'requires_action') {
      run = await this._handleRunToolCalls(run, thread);
    }
    // manage error if status is failed
    if (run.status === 'failed') {
      const errorMessage = `I encountered an error: ${run.last_error?.message || 'Unknown error'}`;
      console.error('Run failed:', run.last_error);
      await this._client.beta.threads.messages.create(thread.id, {
        role: 'assistant',
        content: errorMessage,
      });
      return {
        type: 'text',
        text: {
          value: errorMessage,
          annotations: [],
        },
      };
    }
    // manage success response by default
    const messages = await this._client.beta.threads.messages.list(thread.id);
    const assistantMessage = messages.data.find(
      (message) => message.role === 'assistant',
    );
    console.log(`🚀 Assistant message:`, assistantMessage?.content[0]);
    // return response or default message
    return (
      assistantMessage?.content[0] || {
        type: 'text',
        text: { value: 'No response from assistant', annotations: [] },
      }
    );
  }

  private async _handleRunToolCalls(run: Run, thread: Thread): Promise<Run> {
    console.log(`💾 Handling tool calls for run ${run.id}`);

    const toolCalls = run.required_action?.submit_tool_outputs?.tool_calls;
    if (!toolCalls) {
      console.log('ℹ No tool calls found');
      return run;
    }
    console.log(`🔧 Found ${toolCalls.length} tool calls:`, toolCalls);
    const toolOutputs = await Promise.all(
      toolCalls.map(async (tool) => {
        const ToolConfig = tools[tool.function.name];
        if (!ToolConfig) {
          console.error(`Tool ${tool.function.name} not found`);
          return null;
        }

        console.log(`💾 Executing: ${tool.function.name}...`);

        try {
          const args = JSON.parse(tool.function.arguments);
          const output = await ToolConfig.handler(args);
          console.log(`🔧 Tool ${tool.function.name} output:`, output);
          return {
            tool_call_id: tool.id,
            output: String(output),
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.log(`❌ Tool ${tool.function.name} error:`, errorMessage);
          return {
            tool_call_id: tool.id,
            output: `Error: ${errorMessage}`,
          };
        }
      }),
    );

    const validOutputs = toolOutputs.filter(
      Boolean,
    ) as OpenAI.Beta.Threads.Runs.RunSubmitToolOutputsParams.ToolOutput[];
    if (validOutputs.length === 0) return run;

    return this._client.beta.threads.runs.submitToolOutputsAndPoll(
      thread.id,
      run.id,
      { tool_outputs: validOutputs },
    );
  }

  private async _manageAgents() {
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 second
    const availableAgents = [XAgentService];
    availableAgents.forEach(async (Agent) => {
      const agent = new Agent(this._client);
      await agent.start();
    });
  }
}
