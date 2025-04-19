# obsidian-tasks-mcp

A Model Context Protocol (MCP) server for extracting and querying Obsidian Tasks from markdown files. Designed to work with Claude via the MCP protocol to enable AI-assisted task management.

## Installation

```bash
npm install -g obsidian-tasks-mcp
```

## Usage

### Running the Server

```bash
obsidian-tasks-mcp /path/to/obsidian/vault
```

You can specify multiple directories:

```bash
obsidian-tasks-mcp /path/to/obsidian/vault /another/directory
```

### Using with Claude

Add this configuration to your Claude client that supports MCP:

```json
{
  "mcpServers": {
    "obsidian-tasks": {
      "command": "obsidian-tasks-mcp",
      "args": [
        "/path/to/obsidian/vault"
      ]
    }
  }
}
```

## Features

This MCP server provides the following tools:

### list_all_tasks

Extracts all tasks from markdown files in a directory, recursively scanning through subfolders.

### query_tasks

Searches for tasks based on Obsidian Tasks query syntax. Applies multiple filters to find matching tasks.

Supported query syntax includes:
- Status filters: `done`, `not done`
- Date filters: `due today`, `no due date`, `has due date`
- Tag filters: `has tags`, `no tags`, `tags include #tag`
- Path and description filters
- Priority filters

For more details, see the full documentation at [GitHub Repository](https://github.com/jfim/obsidian-tasks-mcp).

## License

MIT