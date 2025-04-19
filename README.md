# Obsidian Tasks MCP Server

A Model Context Protocol (MCP) server for extracting and querying Obsidian Tasks from markdown files. Designed to work with Claude via the MCP protocol to enable AI-assisted task management.

## Features

- Extract tasks from Obsidian markdown files with a format compatible with the Obsidian Tasks plugin
- Identify completed and pending tasks
- Access task metadata including:
  - Status (complete/incomplete)
  - Due dates
  - Scheduled dates
  - Start dates
  - Created dates
  - Tags
  - Priority
  - Recurrence rules

## Tools

This MCP server provides a single focused tool:

### list_all_tasks

Extracts all tasks from markdown files in a directory, recursively scanning through subfolders.

**Input Parameters:**
- `path` (string, optional): The directory to scan for markdown files. If not specified, defaults to the first allowed directory.

**Returns:**
A JSON array of task objects, each containing:
```json
{
  "id": "string",          // Unique identifier (filepath:linenumber)
  "description": "string", // Full text description of the task
  "status": "complete" | "incomplete", // Task completion status
  "filePath": "string",    // Path to the file containing the task
  "lineNumber": "number",  // Line number in the file
  "tags": ["string"],      // Array of tags found in the task
  "dueDate": "string",     // Optional - YYYY-MM-DD format 
  "scheduledDate": "string", // Optional - YYYY-MM-DD format
  "startDate": "string",   // Optional - YYYY-MM-DD format
  "createdDate": "string", // Optional - YYYY-MM-DD format
  "priority": "string",    // Optional - "high", "medium", or "low"
  "recurrence": "string"   // Optional - recurrence rule
}
```

## Usage

### Installation

```bash
npm install
npm run build
```

### Running the Server

```bash
node dist/index.js /path/to/obsidian/vault
```

You can specify multiple directories:

```bash
node dist/index.js /path/to/obsidian/vault /another/directory
```

### Using with Claude

Add this configuration to your Claude client that supports MCP:

```json
{
  "mcpServers": {
    "obsidian-tasks": {
      "command": "node",
      "args": [
        "/path/to/obsidian-tasks-mcp/dist/index.js",
        "/path/to/obsidian/vault"
      ]
    }
  }
}
```

### Docker

Build the Docker image:

```bash
docker build -t obsidian-tasks-mcp .
```

Run with Docker:

```bash
docker run -i --rm --mount type=bind,src=/path/to/obsidian/vault,dst=/projects/vault obsidian-tasks-mcp /projects
```

Claude Desktop configuration:

```json
{
  "mcpServers": {
    "obsidian-tasks": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "--mount", "type=bind,src=/path/to/obsidian/vault,dst=/projects/vault",
        "obsidian-tasks-mcp",
        "/projects"
      ]
    }
  }
}
```

## Task Format

The server recognizes the following Obsidian Tasks format:

- Task syntax: `- [ ] Task description`
- Completed task: `- [x] Task description`
- Due date: `🗓️ YYYY-MM-DD`
- Scheduled date: `⏳ YYYY-MM-DD`
- Start date: `🛫 YYYY-MM-DD`
- Created date: `➕ YYYY-MM-DD`
- Priority: `⏫` (high), `🔼` (medium), `🔽` (low)
- Recurrence: `🔁 every day/week/month/etc.`
- Tags: `#tag1 #tag2`

Example task: `- [ ] Complete project report 🗓️ 2025-05-01 ⏳ 2025-04-25 #work #report ⏫`

## License

MIT License