export type Message =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: ToolCall[] }
  | { role: "tool_result"; toolCallId: string; result: string };

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AgentState {
  messages: Message[];
  task: string;
  workingDir: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
  execute: (args: Record<string, unknown>, state: AgentState) => Promise<string>;
}

export interface ModelResponse {
  content: string;
  toolCalls?: ToolCall[];
}