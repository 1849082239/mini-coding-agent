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

/** 步骤状态 */
export type TodoStatus = "pending" | "running" | "completed" | "failed";

/** 执行计划中的单个步骤 */
export interface TodoItem {
  id: string;
  description: string;
  status: TodoStatus;
}