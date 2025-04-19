# Obsidian Tasks MCP Server

Node.js server implementing Model Context Protocol (MCP) for Obsidian Tasks integration.

## Features

- Parse Obsidian markdown files to extract tasks
- Identify completed and pending tasks
- Search and filter tasks by various criteria
- Access task metadata (completion status, due dates, tags, etc.)

**Note**: The server will only allow operations within directories specified via `args`.

## API

### Resources

- `obsidian://tasks`: Obsidian Tasks operations interface

### Tools

- **list_all_tasks**
  - Lists all tasks

- **search_tasks**
  - Search tasks based on various criteria
  - Inputs:
    - `filters` (object): Filter criteria (status, tags, due dates, etc.)

## Usage with Claude Desktop

Add this to your `claude_desktop_config.json`:

Note: you can provide sandboxed directories to the server by mounting them to `/projects`. Adding the `ro` flag will make the directory readonly by the server.

### Docker

Note: all directories must be mounted to `/projects` by default.

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

### NPX

```json
{
  "mcpServers": {
    "obsidian-tasks": {
      "command": "npx",
      "args": [
        "-y",
        "obsidian-tasks-mcp",
        "/path/to/obsidian/vault"
      ]
    }
  }
}
```

## Build

Docker build:

```bash
docker build -t obsidian-tasks-mcp .
```

## License

This MCP server is licensed under the MIT License. This means you are free to use, modify, and distribute the software, subject to the terms and conditions of the MIT License.
