import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { Tool, AgentState } from "../types";

const execAsync = promisify(exec);

export const searchTool: Tool = {
  name: "search",
  description:
    "在项目目录中搜索包含指定关键词的文件。" +
    "返回匹配的文件路径、行号和匹配行的内容。" +
    "适合用来定位某个函数、变量或关键词在哪些文件中出现。",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "搜索关键词或正则表达式",
      },
      maxResults: {
        type: "number",
        description: "最多返回多少条结果，默认 20",
      },
    },
    required: ["query"],
  },
  execute: async (args, state: AgentState) => {
    const query = String(args.query);
    const maxResults = Number(args.maxResults) || 20;

    try {
      const { stdout } = await execAsync(
        `rg --line-number --max-count ${maxResults} -- "${query}" "${state.workingDir}"`,
        { maxBuffer: 1024 * 1024 }
      );

      if (!stdout.trim()) {
        return `未找到包含 "${query}" 的文件。`;
      }

      const lines = stdout.trim().split("\n");
      const results = lines.slice(0, maxResults).map((line) => {
        const match = line.match(/^(.+?):(\d+):(.*)$/);
        if (!match) return line;
        const [, filePath, lineNum, content] = match;
        // 转为相对路径，让输出更简洁
        const relativePath = filePath.replace(state.workingDir + "/", "");
        return `${relativePath}:${lineNum}: ${content.trim()}`;
      });

      const truncated =
        lines.length > maxResults
          ? `\n\n... 共 ${lines.length} 条结果，仅显示前 ${maxResults} 条`
          : "";

      return results.join("\n") + truncated;
    } catch (error: unknown) {
      // rg 在没有匹配时返回 exit code 1，这不是错误
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: number }).code === 1
      ) {
        return `未找到包含 "${query}" 的文件。`;
      }
      return `搜索出错：${String(error)}`;
    }
  },
};