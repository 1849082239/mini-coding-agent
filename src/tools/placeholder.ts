import type { Tool } from "../types";

export const placeholderTools: Tool[] = [
  {
    name: "search",
    description: "在项目目录中搜索包含指定关键词的文件",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "搜索关键词" },
      },
      required: ["query"],
    },
    execute: async (args) => {
      return `[占位] 搜索 "${args.query}" — 工具尚未实现`;
    },
  },
  {
    name: "read_file",
    description: "读取指定文件的内容",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "文件路径" },
      },
      required: ["path"],
    },
    execute: async (args) => {
      return `[占位] 读取文件 "${args.path}" — 工具尚未实现`;
    },
  },
];