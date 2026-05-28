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
/**
 * 消息角色类型
 * system: 系统提示词
 * user: 用户输入
 * assistant: 大模型返回的文本回复或思考过程
 * tool_result: 工具执行完毕后返回的结果（第 4 章中，被拒绝的信息也会作为此角色返回）
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool_result';

/**
 * 大模型接口抽象
 * 方便后续切换不同的模型底层（如 OpenAI、Claude、DeepSeek 等）
 */
export interface Model {
  generate(messages: Message[], tools?: Tool[]): Promise<ModelResponse>;
}

/**
 * 核心 Agent 状态
 */
export interface AgentState {
  messages: Message[];
  [key: string]: any; // 允许扩展其他业务上下文状态
}


/**
 * 权限检查结果结构（第 4 章核心新增）
 */
export interface PermissionCheckResult {
  approved: boolean; // 是否允许执行：true 为放行，false 为拦截
  reason: string;    // 原因。放行时可为 'Allowed'，拦截时为具体拒绝原因（如 "包含危险命令"）
}

/**
 * 权限守卫接口（第 4 章核心新增）
 */
export interface PermissionGuard {
  /**
   * 在工具执行前拦截并审查
   * @param toolName 工具名称
   * @param toolArgs 工具参数
   */
  check(toolName: string, toolArgs: any): Promise<PermissionCheckResult>;
}

/**
 * 运行 Agent 的配置项
 */
export interface RunAgentOptions {
  maxIterations?: number;          // 最大迭代次数，默认 15 次
  permissionGuard?: PermissionGuard; // 权限守卫，如果不传则默认全部自动放行（向后兼容）
}

/**
 * Agent 运行结束后的最终返回结果
 */
export interface AgentResult {
  status: 'success' | 'exhausted' | 'failed'; // 运行状态：成功完成、次数耗尽、失败
  messages: Message[];                         // 包含本次运行产生的完整对话历史
  stats: {
    toolCallCount: number;                     // 统计本次运行实际成功执行了多少次工具
  };
  reason?: string;                             // 状态为非 success 时的具体原因说明
}
