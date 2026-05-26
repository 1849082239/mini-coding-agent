import { readFile, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import type { Tool, AgentState } from "../types";

export const patchFileTool: Tool = {
  name: "patch_file",
  description:
    "对已有文件做局部修改。找到文件中的 old_content，替换为 new_content。" +
    "比 write_file 更安全，因为只改一小部分，不会影响文件的其他内容。" +
    "如果 old_content 在文件中出现多次，会报错——请提供更长的上下文来精确定位。",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "文件路径（相对于工作目录）",
      },
      old_content: {
        type: "string",
        description: "要被替换的原始文本（需要和文件中的内容完全一致）",
      },
      new_content: {
        type: "string",
        description: "替换后的新文本",
      },
    },
    required: ["path", "old_content", "new_content"],
  },
  async execute(
  args: Record<string, unknown>,
  state: AgentState,
): Promise<string> {
  const filePath = resolve(state.workingDir, String(args.path));
  const oldContent = String(args.old_content ?? "");
  const newContent = String(args.new_content ?? "");

  /** 第一层：路径安全检查（和 write_file 相同） */
  const normalizedPath = filePath.replace(/\\/g, "/");
  const normalizedWorkingDir = state.workingDir.replace(/\\/g, "/");
  if (!normalizedPath.toLowerCase().startsWith(normalizedWorkingDir.toLowerCase())) {
    return "错误：不能修改工作目录之外的文件。";
  }

  if (normalizedPath.includes("/.git/") || normalizedPath.endsWith("/.git")) {
    return "错误：不允许修改 .git 目录下的文件。";
  }

  /** 第二层：old_content 不能为空 */
  if (!oldContent) {
    return "错误：old_content 不能为空。";
  }

  try {
    const content = await readFile(filePath, "utf-8");

    /** 第三层：检查 old_content 是否存在于文件中 */
    const firstIndex = content.indexOf(oldContent);
    if (firstIndex === -1) {
      return formatNotFoundError(content, oldContent, filePath, state);
    }

    /** 第四层：如果出现多次，要求模型提供更精确的上下文 */
    const secondIndex = content.indexOf(oldContent, firstIndex + 1);
    if (secondIndex !== -1) {
      return (
        `错误：old_content 在文件中出现了多次，请提供更长的上下文来精确定位。\n` +
        `文件：${relative(state.workingDir, filePath)}`
      );
    }

    /** 执行替换 */
    const newFileContent = content.replace(oldContent, newContent);
    await writeFile(filePath, newFileContent, "utf-8");

    /** 计算变更的行号范围，帮助定位修改位置 */
    const beforeLines = content.slice(0, firstIndex).split("\n").length;
    const oldLines = oldContent.split("\n").length;
    const newLines = newContent.split("\n").length;

    const relativePath = relative(state.workingDir, filePath);
    return [
      `已修改 ${relativePath}`,
      `位置：第 ${beforeLines}-${beforeLines + oldLines - 1} 行`,
      `${oldLines} 行 -> ${newLines} 行`,
    ].join("\n");
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return `错误：文件不存在 ${args.path}`;
    }
    return `修改文件出错：${String(error)}`;
  }
}

};
/**
 * 当 old_content 找不到时，给出有帮助的提示
 * 帮助模型调整搜索内容而不是盲目重试
 */
function formatNotFoundError(
  fileContent: string,
  oldContent: string,
  filePath: string,
  state: AgentState,
): string {
  const relativePath = relative(state.workingDir, filePath);

  /** 尝试模糊匹配：如果 old_content 的第一行在文件中存在 */
  const firstLine = oldContent.split("\n")[0];
  const fuzzyIndex = fileContent.indexOf(firstLine);

  if (fuzzyIndex !== -1 && firstLine.length > 3) {
    const lineNum = fileContent.slice(0, fuzzyIndex).split("\n").length;
    return (
      `错误：未在 ${relativePath} 中找到完全匹配的内容。\n` +
      `但第一行 "${firstLine}" 在第 ${lineNum} 行附近有部分匹配。\n` +
      `请使用 read_file 读取该位置附近的代码，确认准确内容后再重试。`
    );
  }

  return `错误：未在 ${relativePath} 中找到指定的 old_content。请先用 read_file 确认文件内容。`;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error;
}
