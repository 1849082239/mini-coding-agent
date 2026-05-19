import OpenAI from "openai";
import type { Message, ModelResponse, Tool, ToolCall } from "./types";

export class Model {
  private client: OpenAI;
  private model: string;

  constructor(options: {
    apiKey: string;
    baseURL?: string;
    model?: string;
  }) {
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
    });
    this.model = options.model ?? "gpt-4o";
  }

  async chat(messages: Message[], tools?: Tool[]): Promise<ModelResponse> {
    const toolDefinitions = tools?.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: messages.map(toOpenAIMessage),
      tools: toolDefinitions,
      temperature: 0,
    });

    const choice = response.choices[0];
    const content = choice.message.content ?? "";
    const toolCalls: ToolCall[] = [];
    for (const tc of choice.message.tool_calls ?? []) {
      if (tc.type === "function") {
        toolCalls.push({
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments),
        });
      }
    }


    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }
}

function toOpenAIMessage(msg: Message): OpenAI.ChatCompletionMessageParam {
  switch (msg.role) {
    case "system":
      return { role: "system", content: msg.content };
    case "user":
      return { role: "user", content: msg.content };
    case "assistant":
      return {
        role: "assistant",
        content: msg.content,
        ...(msg.toolCalls
          ? {
              tool_calls: msg.toolCalls.map((tc) => ({
                id: tc.id,
                type: "function" as const,
                function: {
                  name: tc.name,
                  arguments: JSON.stringify(tc.arguments),
                },
              })),
            }
          : {}),
      };
    case "tool_result":
      return {
        role: "tool",
        tool_call_id: msg.toolCallId,
        content: msg.result,
      };
  }
}