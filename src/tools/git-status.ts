import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { AgentState, Tool } from "../types";

const execAsync = promisify(exec);

/**
 * git status 工具
 *
 * 让 agent 了解当前仓库的状态：哪些文件改了、有没有未追踪的文件。
 * 这是 agent 在修改代码后进行验证的基础。
 */
export const gitStatusTool: Tool = {
  name: "git_status",
  description:
    "查看当前仓库的 git 状态。" +
    "返回修改、暂存、未追踪的文件列表。" +
    "适合在修改文件后检查变更情况。",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },

  async execute(
    _args: Record<string, unknown>,
    state: AgentState,
  ): Promise<string> {
    try {
      const { stdout } = await execAsync("git status --short", {
        cwd: state.workingDir,
      });

      if (!stdout.trim()) {
        return "工作目录干净，没有未提交的变更。";
      }

      return `当前变更:\n${stdout.trim()}`;
    } catch (error: unknown) {
      return `获取 git 状态出错：${String(error)}`;
    }
  },
};