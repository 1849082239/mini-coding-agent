import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { AgentState, Tool } from "../types";

const execAsync = promisify(exec);

/** diff 输出最大长度 */
const MAX_DIFF_LENGTH = 10_000;

/**
 * git diff 工具
 *
 * 让 agent 查看具体的代码变更内容。
 * 和 git_status 互补：status 告诉你"哪些文件改了"，diff 告诉你"改了什么"。
 */
export const gitDiffTool: Tool = {
  name: "git_diff",
  description:
    "查看当前仓库的代码变更详情（git diff）。" +
    "返回具体的增删行内容。" +
    "可以通过 path 参数查看指定文件的变更。",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "可选，只查看指定文件的变更",
      },
      staged: {
        type: "boolean",
        description: "是否查看暂存区的变更（git diff --staged），默认 false",
      },
    },
    required: [],
  },

  async execute(
    args: Record<string, unknown>,
    state: AgentState,
  ): Promise<string> {
    const staged = args.staged === true;
    const path = args.path ? String(args.path) : undefined;

    const parts = ["git diff"];
    if (staged) parts.push("--staged");
    if (path) parts.push("--", path);

    try {
      const { stdout } = await execAsync(parts.join(" "), {
        cwd: state.workingDir,
        maxBuffer: 1024 * 1024,
      });

      if (!stdout.trim()) {
        return staged ? "暂存区没有变更。" : "没有未暂存的变更。";
      }

      if (stdout.length > MAX_DIFF_LENGTH) {
        const truncated = stdout.slice(0, MAX_DIFF_LENGTH);
        return `${truncated}\n\n... diff 输出过长，已截断（共 ${stdout.length} 字符）`;
      }

      return stdout;
    } catch (error: unknown) {
      return `获取 git diff 出错：${String(error)}`;
    }
  },
};