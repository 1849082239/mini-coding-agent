import { readFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import type { Tool, AgentState } from "../types";

export const readFileTool: Tool = {
  name: "read_file",
  description:
    "读取指定文件的内容。" +
    "可以指定读取的起始行和结束行，适合读取大文件的特定部分。" +
    "如果文件超过 200 行，建议只读取相关部分。",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "要读取的文件路径（相对于工作目录）",
      },
      startLine: {
        type: "number",
        description: "起始行号（从 1 开始），默认 1",
      },
      endLine: {
        type: "number",
        description: "结束行号，默认读取到文件末尾（最多 200 行）",
      },
    },
    required: ["path"],
  },
  execute: async (args, state: AgentState) => {
    const filePath = resolve(state.workingDir, String(args.path));
    const startLine = Number(args.startLine) || 1;
    const maxLines = 200;
    const endLine = Number(args.endLine) || startLine + maxLines - 1;

    // 安全检查：确保不会读取工作目录之外的文件
    const normalizedPath = filePath.replace(/\\/g, "/");
    const normalizedWorkingDir = state.workingDir.replace(/\\/g, "/");
    if (!normalizedPath.toLowerCase().startsWith(normalizedWorkingDir.toLowerCase())) {
      return `错误：不能读取工作目录之外的文件。`;
    }

    try {
      const content = await readFile(filePath, "utf-8");
      const lines = content.split("\n");
      const totalLines = lines.length;

      const selectedLines = lines.slice(startLine - 1, endLine);
      const numberedLines = selectedLines.map(
        (line, i) => `${startLine + i}: ${line}`
      );

      const header = `文件: ${relative(state.workingDir, filePath)} (${totalLines} 行)`;
      const range =
        endLine < totalLines
          ? `显示第 ${startLine}-${endLine} 行`
          : `显示第 ${startLine}-${totalLines} 行`;
      const truncation =
        endLine < totalLines
          ? `\n\n... 共 ${totalLines} 行，仅显示第 ${startLine}-${endLine} 行。可以使用 startLine 和 endLine 参数读取更多内容。`
          : "";

      return `${header}\n${range}\n\n${numberedLines.join("\n")}${truncation}`;
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: string }).code === "ENOENT"
      ) {
        return `错误：文件不存在 ${args.path}`;
      }
      return `读取文件出错：${String(error)}`;
    }
  },
};