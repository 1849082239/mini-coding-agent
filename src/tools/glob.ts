// src/tools/glob.ts

import { readdir } from "node:fs/promises";
import type { AgentState, Tool } from "../types";

/**
 * glob 工具：按模式列出文件路径
 *
 * 和 search 工具的区别：
 * - search：在文件内容中搜索关键词（rg）
 * - glob：按文件路径/名称模式列出文件
 *
 * 两种搜索互补。例如：
 * - "哪个文件里有 runAgent 函数" -> search
 * - "项目里有哪些 .test.ts 文件" -> glob
 *
 * 使用 Node.js 内置 fs 实现，不依赖外部命令或第三方库，
 * 在 Windows / Linux / macOS 上都能运行。
 */
export const globTool: Tool = {
  name: "glob",
  description:
    "按文件路径模式列出项目中的文件。" +
    "支持 glob 模式，如 **/*.ts、src/**/*.test.ts。" +
    "适合用来查看项目结构、找到特定类型的文件。",
  parameters: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description: "glob 模式，如 **/*.ts 或 src/**/*.test.ts",
      },
      maxResults: {
        type: "number",
        description: "最多返回多少条结果，默认 50",
      },
    },
    required: ["pattern"],
  },

  async execute(
    args: Record<string, unknown>,
    state: AgentState,
  ): Promise<string> {
    const pattern = String(args.pattern);
    const maxResults = Number(args.maxResults) || 50;

    try {
      /** 排除的目录，不需要搜索 */
      const ignore = new Set(["node_modules", ".git"]);

      /** 递归读取目录下的所有文件路径 */
      const allFiles = await readdir(state.workingDir, {
        recursive: true,
      }).then((entries) =>
        (entries as string[])
          .map((entry) => entry.replace(/\\/g, "/"))
          .filter(
            (entry) =>
              !entry.split("/").some((segment) => ignore.has(segment)),
          ),
      );

      /** 将 glob 模式转为正则：* → [^/]*, ** → .*, ? → [^/] */
      const regex = globToRegex(pattern);
      const matched = allFiles.filter((f) => regex.test(f));

      if (matched.length === 0) {
        return `未找到匹配 "${pattern}" 的文件。`;
      }

      const results = matched.slice(0, maxResults);
      const truncated =
        matched.length > maxResults
          ? `\n\n... 共 ${matched.length} 个文件，仅显示前 ${maxResults} 个`
          : "";

      return results.join("\n") + truncated;
    } catch (error: unknown) {
      return `列出文件出错：${String(error)}`;
    }
  },
};

/**
 * 将简易 glob 模式转为正则表达式
 *
 * 支持的模式：
 * - ** 匹配任意层级目录（包括零层）
 * - *  匹配除 / 外的任意字符
 * - ?  匹配单个字符（除 /）
 * - 其他字符原样匹配
 */
function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]")
    .replace(/\{\{GLOBSTAR\}\}/g, ".*");
  return new RegExp(`^${escaped}$`);
}