import type { Tool } from "../types";
import { searchTool } from "./search";
import { readFileTool } from "./read-file";

export const tools: Tool[] = [searchTool, readFileTool];