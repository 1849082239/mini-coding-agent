import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { AgentState, Tool } from "../types";

const execAsync = promisify(exec);

/** 命令执行超时时间（毫秒） */
const DEFAULT_TIMEOUT = 30_000;

/** 单次输出最大长度，避免把海量日志塞给模型 */
const MAX_OUTPUT_LENGTH = 10_000;

/**
 * 执行命令工具
 *
 * 让 agent 能在本地终端执行命令，如运行测试、lint、build 等。
 * 这是 coding agent "能跑"的核心——只有能执行命令，才能验证自己的修改是否正确。
 *
 * 安全措施：
 * 1. 限制超时（默认 30 秒），防止长时间运行的命令阻塞 agent
 * 2. 限制输出长度，避免海量日志消耗上下文窗口
 * 3. 在工作目录下执行，不会意外跑到其他目录
 */
export const runCommandTool: Tool = {
  name: "run_command",
  description:
    "在终端中执行命令并返回输出。" +
    "适合运行测试、lint、build、脚本等命令。" +
    "命令在工作目录下执行。" +
    "超时时间为 30 秒。",
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "要执行的命令",
      },
      timeout: {
        type: "number",
        description: "超时时间（毫秒），默认 30000",
      },
    },
    required: ["command"],
  },

  async execute(
    args: Record<string, unknown>,
    state: AgentState,
  ): Promise<string> {
    const command = String(args.command);
    const timeout = Number(args.timeout) || DEFAULT_TIMEOUT;

    if (!command.trim()) {
      return "错误：命令不能为空。";
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: state.workingDir,
        timeout,
        maxBuffer: 1024 * 1024,
      });

      return formatCommandResult(stdout, stderr);
    } catch (error: unknown) {
      return formatCommandError(error);
    }
  },
};

function truncateOutput(output: string): string {
  if (output.length <= MAX_OUTPUT_LENGTH) return output;
  const kept = output.slice(0, MAX_OUTPUT_LENGTH);
  const totalLines = output.split("\n").length;
  const keptLines = kept.split("\n").length;
  return `${kept}\n\n... 输出过长，已截断（显示前 ${keptLines}/${totalLines} 行）`;
}

function formatCommandResult(stdout: string, stderr: string): string {
  const parts: string[] = [];

  if (stdout.trim()) {
    const truncated = truncateOutput(stdout.trim());
    parts.push(`stdout:\n${truncated}`);
  }

  if (stderr.trim()) {
    const truncated = truncateOutput(stderr.trim());
    parts.push(`stderr:\n${truncated}`);
  }

  if (parts.length === 0) {
    return "命令执行成功（无输出）。";
  }

  return parts.join("\n\n");
}

function formatCommandError(error: unknown): string {
  if (isExecError(error)) {
    const parts: string[] = [`exit code: ${error.code}`];

    if (error.stdout?.trim()) {
      parts.push(`stdout:\n${truncateOutput(error.stdout.trim())}`);
    }

    if (error.stderr?.trim()) {
      parts.push(`stderr:\n${truncateOutput(error.stderr.trim())}`);
    }

    if (error.killed) {
      parts.push("命令因超时被终止。");
    }

    return parts.join("\n\n");
  }

  return `执行命令出错：${String(error)}`;
}

function isExecError(
  error: unknown,
): error is {
  code: number | null;
  stdout: string;
  stderr: string;
  killed: boolean;
  message: string;
} {
  return (
    error != null &&
    typeof error === "object" &&
    "code" in error &&
    (typeof (error as { code: unknown }).code === "number" ||
      (error as { code: unknown }).code === null)
  );
}