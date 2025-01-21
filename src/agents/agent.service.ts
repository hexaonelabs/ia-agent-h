import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { Thread } from 'openai/resources/beta/threads/threads';
import { Assistant } from 'openai/resources/beta/assistants';
import { Run } from 'openai/resources/beta/threads/runs/runs';
import { parse } from 'marked';
import {
  getAssistantConfig,
  getAssistantCtrl,
  getAssistantsFileName,
  getAssistantToolsFunction,
  ToolConfig,
  getAssistantPrompt,
} from '../utils';
import { CustomLogger } from '../logger.service';
import { SendPromptDto } from '../server/dto/send-prompt.dto';
import * as fs from 'fs';
import { join } from 'path';
import { TaskSchedulerService } from '../server/task-scheduler.service';

@Injectable()
export class AgentService {
  private readonly _client: OpenAI;
  private _agent?: {
    assistant: Assistant;
    tools: ToolConfig<any>[];
  };
  private _managedAgents: Record<
    string,
    {
      assistant: OpenAI.Beta.Assistants.Assistant;
      tools: ToolConfig<any>[];
      ctrl: {
        start: () => Promise<void>;
      };
    }
  > = {};
  public readonly threads: Thread[] = [];
  private readonly inMemoryThreadsMesssages: Record<string, string[]> = {};
  private readonly _logger = new CustomLogger(AgentService.name);
  constructor(private _taskSchedulerService: TaskSchedulerService) {
    this._taskSchedulerService.setExecuter(this.sendMessage.bind(this));
    this._client = new OpenAI();
    this._createAssistant(this._client, 'agent-h')
      .then(async ({ assistant, tools }) => {
        this._agent = {
          assistant,
          tools,
        };
      })
      .then(async () => {
        await this._manageAgents();
      });
  }

  async createThread() {
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

  async sendMessage(params: SendPromptDto) {
    const { threadId, userInput } = params;
    const thread = !threadId
      ? await this.createThread()
      : this.threads.find((thread) => thread.id === threadId);
    if (!thread) throw new Error('Thread not found');

    try {
      await this._client.beta.threads.messages.create(thread.id, {
        role: 'user',
        content: userInput,
      });
      const run = await this._createRun(thread);
      const result = await this._performRun(run, thread);

      //check if the assistant has scheduled a task
      const assistantMessage = result?.content;
      const toolCalls = result?.toolCalls;

      if (toolCalls && toolCalls.length > 0) {
        const planExecutionCall = toolCalls.find(
          (call) => call.function.name === 'plan_execution',
        );

        if (planExecutionCall) {
          // extract the timestamp and prompt from the tool call arguments
          const { timestamp, prompt } = JSON.parse(
            planExecutionCall.function.arguments,
          );
          // log the scheduled task
          this._logger.log(`Task scheduled for ${timestamp}: ${prompt}`);
          // Save the scheduled task in the file
          const task = `${timestamp}: ${prompt}`;
          const filesPath = join(
            process.cwd(),
            'public',
            'logs',
            'scheduled-tasks.txt',
          );
          if (!fs.existsSync(filesPath)) {
            fs.writeFileSync(filesPath, '');
          }
          fs.appendFileSync(filesPath, `${task}\n`);
          return {
            threadId: thread.id,
            message: 'Tâche planifiée avec succès',
          };
        }
      }

      const response =
        assistantMessage?.type === 'text'
          ? assistantMessage.text.value
          : 'No text response';

      if (!this.inMemoryThreadsMesssages[thread.id]) {
        this.inMemoryThreadsMesssages[thread.id] = [];
      }
      this.inMemoryThreadsMesssages[thread.id].push(...[userInput, response]);
      return { threadId: thread.id, message: await parse(response) };
    } catch (error) {
      const message = `Error during chat: ${error instanceof Error ? error.message : 'Unknown error'}`;
      throw new Error(message);
    }
  }

  private async _createAssistant(
    client: OpenAI,
    fileName: string,
  ): Promise<{
    assistant: Assistant;
    tools: ToolConfig<any>[];
  }> {
    const { Name: name } = getAssistantConfig(fileName);
    const instructions = await getAssistantPrompt(fileName);
    const tools = await getAssistantToolsFunction(fileName);
    const toolsDefinition = Object.values(tools).map((tool) => tool.definition);
    const toolsName = toolsDefinition.map((t) => t.function.name);
    this._logger.log(`🤖 Creating assistant: ${name}`);
    this._logger.log(`🤖 Add tool to ${name}: ${JSON.stringify(toolsName)}`);
    const assistant = await client.beta.assistants.create({
      model: 'gpt-4o-mini',
      name,
      instructions,
      tools: toolsDefinition,
    });
    return {
      assistant,
      tools,
    };
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
    const assistantId = this._agent?.assistant.id;
    if (!assistantId) {
      throw new Error('No assistant found');
    }
    this._logger.log(
      `🚀 Creating run for thread ${thread.id} with assistant ${assistantId}`,
    );
    let run = await this._client.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId,
      tools: [
        // agent tools
        ...(this._agent?.assistant.tools || []),
        // add all other agents tools to the run that the assistant will know all the team capabilities
        ...Object.values(this._managedAgents)
          .flatMap((agent) => agent.tools)
          .map((tool) => tool.definition),
      ],
    });
    // Wait for the run to complete and keep polling
    while (run.status === 'in_progress' || run.status === 'queued') {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
      run = await this._client.beta.threads.runs.retrieve(thread.id, run.id);
    }
    return run;
  }

  private async _performRun(
    run: Run,
    thread: Thread,
  ): Promise<{
    toolCalls?: OpenAI.Beta.Threads.Runs.RequiredActionFunctionToolCall[];
    content: OpenAI.Beta.Threads.Messages.MessageContent;
  }> {
    this._logger.log(`🚀 Performing run ${run.id}`);
    // execute action to call if status is requires_action
    while (run.status === 'requires_action') {
      run = await this._handleRunToolCalls(run, thread);
    }
    // manage error if status is failed
    if (run.status === 'failed') {
      const errorMessage = `${run.last_error?.message || 'Unknown error'}`;
      this._logger.error('Run failed:', run.last_error);
      await this._client.beta.threads.messages.create(thread.id, {
        role: 'assistant',
        content: errorMessage,
      });
      // generate response based on the error message to better explain the error
      const value = await this.generateErrorResponse(errorMessage);
      await this._client.beta.threads.messages.create(thread.id, {
        role: 'assistant',
        content: value,
      });
      return {
        content: {
          type: 'text',
          text: {
            value,
            annotations: [],
          },
        },
      };
    }
    // manage success response by default
    const messages = await this._client.beta.threads.messages.list(thread.id);
    const assistantMessage = messages.data.find(
      (message) => message.role === 'assistant',
    );
    const toolCalls = run.required_action?.submit_tool_outputs
      ?.tool_calls as OpenAI.Beta.Threads.Runs.RequiredActionFunctionToolCall[];
    this._logger.log(
      `🚀 Assistant message: ${JSON.stringify(assistantMessage?.content)}`,
    );
    return {
      toolCalls,
      content: (assistantMessage?.content?.[0] as any) || {
        text: 'text',
        value: 'No response from assistant',
      },
    };
  }

  private async _handleRunToolCalls(run: Run, thread: Thread): Promise<Run> {
    this._logger.log(`💾 Handling tool calls for run ${run.id}`);

    const toolCalls = run.required_action?.submit_tool_outputs?.tool_calls;
    if (!toolCalls) {
      this._logger.log('ℹ️ No tool calls found');
      return run;
    }
    this._logger.log(
      `🔧 Found ${toolCalls.length} tool calls: ${JSON.stringify(toolCalls)}`,
    );
    // perform agent delegation logic
    const toolOutputs = [];
    for (const tool of toolCalls) {
      // For each `tool_call`, find the agent that has the tool
      const agent = [...Object.values(this._managedAgents), this._agent].find(
        (a) => {
          return a.assistant.tools
            .filter((t) => t.type === 'function')
            .find((t) => t.function.name === tool.function.name)
            ? a.assistant.tools
            : null;
        },
      );
      // then find the tool configuration
      const ToolConfig = agent?.tools.find(
        (t) => t.definition.function.name === tool.function.name,
      );
      if (!ToolConfig) {
        throw new Error(`Tool ${tool.function.name} not found`);
      }
      // finally execute the tool handler function
      this._logger.log(
        `💾 Assistant "${agent.assistant.name}" executing: ${tool.function.name}...`,
      );
      const args = JSON.parse(tool.function.arguments);
      // handle error OR response to send to the assistant
      const output = await ToolConfig.handler(
        args,
        tool.function.name === 'plan_execution'
          ? this._taskSchedulerService
          : undefined,
      ).catch((error) => {
        const message =
          error?.message ||
          error ||
          `An error occured while executing ${tool.function.name}`;
        return `ERROR: ${message}`;
      });
      this._logger.log(
        `🔧 Assistant "${agent.assistant.name}" tool ${tool.function.name} output: ${JSON.stringify({ output })}`,
      );
      toolOutputs.push({
        tool_call_id: tool.id,
        output: JSON.stringify(output),
      });
    }
    // Aggregate the results and return to the user
    this._logger.log(
      `🔧 Aggregated tool outputs: ${JSON.stringify(toolOutputs)}`,
    );
    const validOutputs = toolOutputs.filter(Boolean);
    // exclude empty outputs and while performing the tool calls until
    // all the outputs are valid with a value event if it's an error message
    if (validOutputs.length === 0) return run;
    // Submit the tool outputs and poll for the run status
    return this._client.beta.threads.runs.submitToolOutputsAndPoll(
      thread.id,
      run.id,
      { tool_outputs: validOutputs },
    );
  }

  private async _manageAgents() {
    await new Promise((resolve) => setTimeout(resolve, 2500)); // Wait 2.5 seconds
    // load all files characters in the agents folder to get all files name
    this._logger.log(`🤖 Loding assistant from 'charateres/{FILE_NAME}.yml`);
    const agentsFileName = getAssistantsFileName();
    if (agentsFileName.length === 0) {
      this._logger.log('🤖 No other assistant found');
      return;
    }
    this._logger.log(`🤖 Assistants enabled: ${agentsFileName.join(', ')}`);
    // loop over the files name to get the assistant config
    agentsFileName.forEach(async (fileName) => {
      try {
        const { assistant, tools } = await this._createAssistant(
          this._client,
          fileName,
        );
        const ctrl = await getAssistantCtrl(fileName);
        const agent = { assistant, ctrl, tools };
        // start agent befor store it
        if (ctrl) {
          await ctrl?.start(); // start the agent controller
        }
        this._managedAgents[fileName] = agent;
        this._logger.log(`🤖 Assistant ${fileName} started`);
      } catch (error) {
        this._logger.error(
          `🤖 Assistant ${fileName} error: ${error?.message ? error?.message : ''}`,
        );
      }
    });
  }

  /**
   * When an error occurs, this function is called to generate a response
   * that explains the error to a noob.
   * @param errorMessage
   * @returns
   */
  async generateErrorResponse(errorMessage: string): Promise<string> {
    const prompt = `I encountered an error explain to a noobs: ${errorMessage}`;
    try {
      const response = await this._client.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: prompt,
          },
        ],
        model: 'gpt-3.5-turbo',
        n: 1,
        max_tokens: 100,
        temperature: 0.7,
      });
      const explanation = response.choices[0].message.content.trim();
      return explanation;
    } catch (error) {
      console.error('Error during message generation:', error);
      return 'AN error occured while generating the response';
    }
  }
}
