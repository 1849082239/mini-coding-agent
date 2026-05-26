import type { Tool } from "../types";
import { searchTool } from "./search";
import { globTool } from "./glob";
import { readFileTool } from "./read-file";
import { createTodosTool } from "./create-todos";
import { updateTodoTool } from "./update-todo";
import { patchFileTool } from "./patch-file";
import { writeFileTool } from "./write-file";
import { placeholderTools } from "./placeholder";
import { runCommandTool } from "./run-command";
import { TodoManager } from "../todo";
import { gitStatusTool } from "./git-status";
import { gitDiffTool } from "./git-diff";

const todoManager = new TodoManager();

export const tools: Tool[] = [
  globTool,
  searchTool,
  readFileTool,
  createTodosTool(todoManager),
  updateTodoTool(todoManager),
  patchFileTool,
  writeFileTool,
  runCommandTool,
  gitStatusTool,
  gitDiffTool,
];

export {
  searchTool,
  globTool,
  readFileTool,
  createTodosTool,
  updateTodoTool,
  patchFileTool,
  writeFileTool,
  placeholderTools,
  runCommandTool,
  gitStatusTool,
  gitDiffTool,
};