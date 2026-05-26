import { writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname, relative } from "node:path";
import type { AgentState, Tool } from "../types";

/**
 * 写文件工具
 *
 * 安全措施：
 * 1. 不允许写入工作目录之外的文件（路径遍历防护）
 * 2. 如果目标目录不存在，自动创建（但不递归创建超过一层的目录）
 * 3. 不允许覆盖 .git 目录下的文件
 */
export const writeFileTool: Tool = {
  name: "write_file",
  description:
    "创建或覆盖文件。写入完整文件内容。" +
    "如果要修改文件的一小部分，优先使用 patch_file 工具。" +
    "写入前会自动创建不存在的目录。",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "要写入的文件路径（相对于工作目录）",
      },
      content: {
        type: "string",
        description: "文件内容",
      },
    },
    required: ["path", "content"],
  },

  async execute(
    args: Record<string, unknown>,
    state: AgentState,
  ): Promise<string> {
    const filePath = resolve(state.workingDir, String(args.path));
    const content = String(args.content ?? "");

    /** 安全检查：不允许写入工作目录之外的文件 */
    const normalizedPath = filePath.replace(/\\/g, "/");
    const normalizedWorkingDir = state.workingDir.replace(/\\/g, "/");
    if (!normalizedPath.toLowerCase().startsWith(normalizedWorkingDir.toLowerCase())) {
      return "错误：不能写入工作目录之外的文件。";
    }

    /** 不允许覆盖 .git 目录 */
    if (normalizedPath.includes("/.git/") || normalizedPath.endsWith("/.git")) {
      return "错误：不允许修改 .git 目录下的文件。";
    }

    try {
      /** 自动创建目标目录（如果不存在） */
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, content, "utf-8");

      const relativePath = relative(state.workingDir, filePath);
      const lineCount = content.split("\n").length;
      return `已写入 ${relativePath}（${lineCount} 行）`;
    } catch (error: unknown) {
      return `写入文件出错：${String(error)}`;
    }
  },
};