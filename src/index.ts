#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ToolSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";
import os from 'os';
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { glob } from 'glob';

// Command line argument parsing
const args = process.argv.slice(2);
if (args.length === 0 && process.env.NODE_ENV !== 'test') {
  console.error("Usage: obsidian-tasks-mcp <vault-directory>");
  process.exit(1);
}

// Normalize all paths consistently
export function normalizePath(p: string): string {
  return path.normalize(p);
}

export function expandHome(filepath: string): string {
  if (filepath.startsWith('~/') || filepath === '~') {
    return path.join(os.homedir(), filepath.slice(1));
  }
  return filepath;
}

// Set up a single vault directory
const vaultDirectory = args.length > 0 ? 
  normalizePath(path.resolve(expandHome(args[0]))) :
  // For tests, use current directory if no args provided
  normalizePath(path.resolve(process.cwd()));

// Validate that the vault directory exists and is accessible
if (process.env.NODE_ENV !== 'test') {
  try {
    const stats = await fs.stat(vaultDirectory);
    if (!stats.isDirectory()) {
      console.error(`Error: ${args[0]} is not a directory`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error accessing directory ${args[0]}:`, error);
    process.exit(1);
  }
}

// Security utilities
function validateRelativePath(relativePath: string): void {
  // Check for directory traversal attempts
  if (relativePath.includes('..')) {
    throw new Error(`Access denied - directory traversal detected in path: ${relativePath}`);
  }
  
  // Additional path validation can be added here if needed
}

async function resolvePath(relativePath: string = ''): Promise<string> {
  // Validate the relative path doesn't contain directory traversal
  validateRelativePath(relativePath);
  
  // Resolve the path relative to vault directory
  const absolute = path.join(vaultDirectory, relativePath);
  
  // For testing environment, we'll simplify path resolution
  if (process.env.NODE_ENV === 'test') {
    // Just return the joined path for tests
    return absolute;
  }
  
  // In production mode, handle symlinks and additional security checks
  try {
    const realPath = await fs.realpath(absolute);
    // Ensure the resolved path is still within the vault directory
    if (!normalizePath(realPath).startsWith(vaultDirectory)) {
      throw new Error("Access denied - symlink target outside vault directory");
    }
    return realPath;
  } catch (error) {
    // For new files that don't exist yet, verify parent directory
    const parentDir = path.dirname(absolute);
    try {
      const realParentPath = await fs.realpath(parentDir);
      if (!normalizePath(realParentPath).startsWith(vaultDirectory)) {
        throw new Error("Access denied - parent directory outside vault directory");
      }
      return absolute;
    } catch {
      throw new Error(`Parent directory does not exist: ${parentDir}`);
    }
  }
}

// Schema definitions
export const ListAllTasksArgsSchema = z.object({
  path: z.string().optional(),
});

export const QueryTasksArgsSchema = z.object({
  path: z.string().optional(),
  query: z.string(),
});

const ToolInputSchema = ToolSchema.shape.inputSchema;
type ToolInput = z.infer<typeof ToolInputSchema>;

// Server setup
const server = new Server(
  {
    name: "obsidian-tasks-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Tool implementations

// Task-related interfaces and functions
export interface Task {
  id: string;
  description: string;
  status: 'complete' | 'incomplete';
  filePath: string;
  lineNumber: number;
  tags: string[];
  dueDate?: string;
  scheduledDate?: string;
  createdDate?: string;
  startDate?: string;
  priority?: string;
  recurrence?: string;
}

// Regular expression for finding tasks in markdown files, based on obsidian-tasks
const taskRegex = /^([\s\t>]*)([-*+]|[0-9]+[.)])( +\[(.)?\])(.*)/u;
const hashTagsRegex = /(^|\s)#[^ !@#$%^&*(),.?":{}|<>]+/g;

// Date related regular expressions
const dueDateRegex = /🗓️\s?(\d{4}-\d{2}-\d{2})/;
const scheduledDateRegex = /⏳\s?(\d{4}-\d{2}-\d{2})/;
const startDateRegex = /🛫\s?(\d{4}-\d{2}-\d{2})/;
const createdDateRegex = /➕\s?(\d{4}-\d{2}-\d{2})/;
const priorityRegex = /⏫|🔼|🔽/;
const recurrenceRegex = /🔁\s?(.*?)(?=(\s|$))/;

export async function findAllMarkdownFiles(startPath: string): Promise<string[]> {
  const pattern = path.join(startPath, '**/*.md');
  return glob(pattern);
}

export async function extractTasksFromFile(filePath: string): Promise<Task[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const tasks: Task[] = [];
    
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
      const line = lines[lineNumber];
      const match = line.match(taskRegex);
      
      if (match) {
        const statusChar = match[4];
        const description = match[5].trim();
        
        // Extract tags
        const tags = (description.match(hashTagsRegex) || [])
          .map(tag => tag.trim())
          .filter(tag => tag.length > 0);
        
        // Check for dates
        const dueMatch = description.match(dueDateRegex);
        const scheduledMatch = description.match(scheduledDateRegex);
        const startMatch = description.match(startDateRegex);
        const createdMatch = description.match(createdDateRegex);
        const recurrenceMatch = description.match(recurrenceRegex);
        
        // Determine priority
        let priority = undefined;
        if (description.includes('⏫')) priority = 'high';
        else if (description.includes('🔼')) priority = 'medium';
        else if (description.includes('🔽')) priority = 'low';
        
        // Create a unique ID
        const id = `${filePath}:${lineNumber}`;
        
        const task: Task = {
          id,
          description,
          status: ['x', 'X'].includes(statusChar) ? 'complete' : 'incomplete',
          filePath,
          lineNumber,
          tags,
          dueDate: dueMatch ? dueMatch[1] : undefined,
          scheduledDate: scheduledMatch ? scheduledMatch[1] : undefined,
          startDate: startMatch ? startMatch[1] : undefined,
          createdDate: createdMatch ? createdMatch[1] : undefined,
          priority,
          recurrence: recurrenceMatch ? recurrenceMatch[1] : undefined
        };
        
        tasks.push(task);
      }
    }
    
    return tasks;
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    return [];
  }
}

export async function findAllTasks(directoryPath: string): Promise<Task[]> {
  const markdownFiles = await findAllMarkdownFiles(directoryPath);
  const allTasks: Task[] = [];
  
  for (const filePath of markdownFiles) {
    try {
      // Extract tasks from each file
      const tasks = await extractTasksFromFile(filePath);
      allTasks.push(...tasks);
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
    }
  }
  
  return allTasks;
}

// Simple but flexible query parser for Obsidian Tasks-like queries
export function parseQuery(queryText: string) {
  // Split into lines and remove empty ones
  const lines = queryText.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
  
  return {
    filters: lines
  };
}

// Apply a single filter to a task
export function applyFilter(task: Task, filter: string): boolean {
  filter = filter.toLowerCase().trim();
  
  // Done/not done status
  if (filter === 'done') {
    return task.status === 'complete';
  }
  if (filter === 'not done') {
    return task.status === 'incomplete';
  }
  
  // Due date filters
  if (filter.startsWith('due') || filter === 'has due date' || filter === 'no due date') {
    if (filter === 'due today') {
      const today = new Date().toISOString().split('T')[0];
      return task.dueDate === today;
    }
    if (filter === 'due before today') {
      const today = new Date().toISOString().split('T')[0];
      return task.dueDate !== undefined && task.dueDate < today;
    }
    if (filter === 'due after today') {
      const today = new Date().toISOString().split('T')[0];
      return task.dueDate !== undefined && task.dueDate > today;
    }
    if (filter === 'no due date') {
      return task.dueDate === undefined;
    }
    if (filter === 'has due date') {
      return task.dueDate !== undefined;
    }
    // More due date logic could be added here
  }
  
  // Tag filters
  if (filter.startsWith('tag') || filter.startsWith('tags')) {
    if (filter === 'no tags') {
      return task.tags.length === 0;
    }
    if (filter === 'has tags') {
      return task.tags && task.tags.length > 0;
    }
    
    if (filter.includes('include')) {
      const tagToFind = filter.split('include')[1].trim().replace(/^#/, '');
      return task.tags.some(tag => tag.replace(/^#/, '').includes(tagToFind));
    }
    
    if (filter.includes('do not include')) {
      const tagToExclude = filter.split('do not include')[1].trim().replace(/^#/, '');
      return !task.tags.some(tag => tag.replace(/^#/, '').includes(tagToExclude));
    }
  }
  
  // Path/filename filters
  if (filter.startsWith('path includes')) {
    const pathToFind = filter.split('includes')[1].trim();
    return task.filePath.toLowerCase().includes(pathToFind.toLowerCase());
  }
  
  if (filter.startsWith('path does not include')) {
    const pathToExclude = filter.split('does not include')[1].trim();
    return !task.filePath.toLowerCase().includes(pathToExclude.toLowerCase());
  }
  
  // Description filters
  if (filter.startsWith('description includes')) {
    const textToFind = filter.split('includes')[1].trim();
    return task.description.toLowerCase().includes(textToFind.toLowerCase());
  }
  
  if (filter.startsWith('description does not include')) {
    const textToExclude = filter.split('does not include')[1].trim();
    return !task.description.toLowerCase().includes(textToExclude.toLowerCase());
  }
  
  // Priority filters
  if (filter.startsWith('priority is')) {
    const priority = filter.split('priority is')[1].trim();
    if (priority === 'high') {
      return task.priority === 'high';
    }
    if (priority === 'medium') {
      return task.priority === 'medium';
    }
    if (priority === 'low') {
      return task.priority === 'low';
    }
    if (priority === 'none') {
      return task.priority === undefined;
    }
  }
  
  // Boolean combinations with parentheses
  if (filter.includes('AND') || filter.includes('OR') || filter.includes('NOT')) {
    // This is a placeholder - in a full implementation, you would need to
    // parse boolean expressions with parentheses
    console.warn("Boolean combinations not fully implemented in filters");
  }
  
  // If no filter match, default to including the task
  return true;
}

// Apply a query to a list of tasks
export function queryTasks(tasks: Task[], queryText: string): Task[] {
  const query = parseQuery(queryText);
  
  // Apply all filters in sequence (AND logic between lines)
  return tasks.filter(task => {
    for (const filter of query.filters) {
      if (!applyFilter(task, filter)) {
        return false;
      }
    }
    return true;
  });
}



// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_all_tasks",
        description:
          "Extract all tasks from markdown files in a directory. " +
          "Recursively scans all markdown files and extracts tasks based on the Obsidian Tasks format. " +
          "Returns structured data about each task including status, dates, and tags. " +
          "The path parameter is optional; if not specified, it defaults to the vault root directory. " +
          "The path must be relative to the vault directory and cannot contain directory traversal components (..).",
        inputSchema: zodToJsonSchema(ListAllTasksArgsSchema) as ToolInput,
      },
      {
        name: "query_tasks",
        description:
          "Search for tasks based on Obsidian Tasks query syntax. " +
          "Allows filtering tasks by status, dates, description, tags, priority, and path. " +
          "Each line in the query is treated as a filter with AND logic between lines. " +
          "Returns only tasks that match all query conditions. " +
          "The path parameter is optional; if not specified, it defaults to the vault root directory. " +
          "The path must be relative to the vault directory and cannot contain directory traversal components (..).",
        inputSchema: zodToJsonSchema(QueryTasksArgsSchema) as ToolInput,
      }
    ],
  };
});


// Exported handlers for testing
export async function handleListAllTasksRequest(args: any) {
  try {
    const parsed = ListAllTasksArgsSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(`Invalid arguments for list_all_tasks: ${parsed.error}`);
    }
    
    // Use specified path or default to vault root directory
    const relativePath = parsed.data.path || '.';
    
    // Validate and resolve the path (even in test mode)
    const validPath = await resolvePath(relativePath);
    
    const tasks = await findAllTasks(validPath);
    return {
      content: [{ type: "text", text: JSON.stringify(tasks, null, 2) }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
}

export async function handleQueryTasksRequest(args: any) {
  try {
    const parsed = QueryTasksArgsSchema.safeParse(args);
    if (!parsed.success) {
      throw new Error(`Invalid arguments for query_tasks: ${parsed.error}`);
    }
    
    // Use specified path or default to vault root directory
    const relativePath = parsed.data.path || '.';
    
    // Validate and resolve the path (even in test mode)
    const validPath = await resolvePath(relativePath);
    
    // Get all tasks from the directory
    const allTasks = await findAllTasks(validPath);
    
    // Apply the query to filter tasks
    const filteredTasks = queryTasks(allTasks, parsed.data.query);
    
    return {
      content: [{ type: "text", text: JSON.stringify(filteredTasks, null, 2) }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    if (name === "list_all_tasks") {
      return await handleListAllTasksRequest(args);
    }
    
    if (name === "query_tasks") {
      return await handleQueryTasksRequest(args);
    }
    
    throw new Error(`Unknown tool: ${name}`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
});

// Start server
async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Obsidian Tasks MCP Server running on stdio");
  console.error("Vault directory:", vaultDirectory);
}

// Don't run the server in test mode
if (process.env.NODE_ENV !== 'test' && process.env.DISABLE_SERVER !== 'true') {
  runServer().catch((error) => {
    console.error("Fatal error running server:", error);
    process.exit(1);
  });
}
