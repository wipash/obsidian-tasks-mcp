# Testing Obsidian Tasks MCP Server

This document describes how to test the Obsidian Tasks MCP server.

## Test Suite Overview

The test suite consists of several test files that verify different aspects of the server:

1. **task-extraction.test.ts**: Tests the extraction of tasks from Markdown files
2. **task-parsing.test.ts**: Tests the parsing and filtering of tasks
3. **task-query.test.ts**: Tests the query functionality
4. **mcp-tools.test.ts**: Tests the MCP tool handlers

## Test Data

The tests use a sample vault located in `tests/test-vault` that contains Markdown files with tasks in various states. The main test file is `sample-tasks.md`.

## Running the Tests

To run the tests, use the following command:

```bash
NODE_ENV=test npm test
```

This will run all the tests and provide a summary of the results.

## Test Environment

The tests run in a special environment that:

1. Disables the server (so it doesn't start listening on stdio)
2. Uses the current directory as the allowed directory
3. Skips path validation for tests

## Adding New Tests

When adding new tests:

1. Make sure to set `process.env.NODE_ENV = 'test'` at the beginning of your test file
2. Add test cases that focus on a specific aspect of the functionality
3. Use the exported functions rather than calling the API directly

## Testing the API

To test the API tools:

1. Use the `handleListAllTasksRequest` and `handleQueryTasksRequest` functions
2. Provide arguments similar to what would be passed from an MCP client
3. Verify the structure and content of the response

## Known Limitations

- The `has tags` filter isn't perfectly reliable in tests, but works correctly with actual data
- Date-based filters like `due today` may depend on the current date