import type { Tool } from "../types";
import { searchTool } from "./search";
import { readFileTool } from "./read-file";
import { createTodosTool } from "./create-todos";
import { updateTodoTool } from "./update-todo";
import { TodoManager } from "../todo";

const todoManager = new TodoManager();

export const tools: Tool[] = [
  searchTool,
  readFileTool,
  createTodosTool(todoManager),
  updateTodoTool(todoManager),
];