import { z } from 'zod';
import path from 'path';

// We'll need to mock the MCP server for these tests, but we can test the handlers
// Import the schemas and handler functions (we'll need to export them from index.ts)
import { 
  ListAllTasksArgsSchema, 
  QueryTasksArgsSchema,
  handleListAllTasksRequest,
  handleQueryTasksRequest
} from '../src/index.js';

// Disable server auto-start for tests
process.env.DISABLE_SERVER = 'true';

describe('MCP Tool Handlers', () => {
  const testVaultPath = path.resolve(process.cwd(), 'tests', 'test-vault');
  
  test('ListAllTasksArgsSchema should validate correctly', () => {
    // Valid inputs
    expect(() => ListAllTasksArgsSchema.parse({})).not.toThrow();
    expect(() => ListAllTasksArgsSchema.parse({ path: testVaultPath })).not.toThrow();
    
    // Invalid path type should fail
    expect(() => 
      ListAllTasksArgsSchema.parse({ path: 123 })
    ).toThrow();
  });
  
  test('QueryTasksArgsSchema should validate correctly', () => {
    // Valid inputs
    expect(() => QueryTasksArgsSchema.parse({ query: 'done' })).not.toThrow();
    expect(() => QueryTasksArgsSchema.parse({ 
      path: testVaultPath,
      query: 'not done'
    })).not.toThrow();
    
    // Missing required field should fail
    expect(() => 
      QueryTasksArgsSchema.parse({})
    ).toThrow();
    
    // Invalid query type should fail
    expect(() => 
      QueryTasksArgsSchema.parse({ query: 123 })
    ).toThrow();
  });
  
  test('handleListAllTasksRequest should return tasks', async () => {
    const result = await handleListAllTasksRequest({ path: testVaultPath });
    expect(result.content).toBeDefined();
    expect(result.content.length).toBe(1);
    expect(result.content[0].type).toBe('text');
    
    // Parse the JSON string to verify the structure
    const tasks = JSON.parse(result.content[0].text);
    expect(Array.isArray(tasks)).toBe(true);
    expect(tasks.length).toBeGreaterThan(0);
    
    // Check task structure
    const task = tasks[0];
    expect(task.id).toBeDefined();
    expect(task.description).toBeDefined();
    expect(task.status).toBeDefined();
    expect(task.filePath).toBeDefined();
    expect(task.lineNumber).toBeDefined();
    expect(Array.isArray(task.tags)).toBe(true);
  });
  
  test('handleQueryTasksRequest should return filtered tasks', async () => {
    const result = await handleQueryTasksRequest({ 
      path: testVaultPath,
      query: 'done'
    });
    
    expect(result.content).toBeDefined();
    expect(result.content.length).toBe(1);
    expect(result.content[0].type).toBe('text');
    
    // Parse the JSON string to verify the structure
    const tasks = JSON.parse(result.content[0].text);
    expect(Array.isArray(tasks)).toBe(true);
    expect(tasks.length).toBeGreaterThan(0);
    
    // Should only have completed tasks
    expect(tasks.every((task: any) => task.status === 'complete')).toBe(true);
  });
  
  test('handleQueryTasksRequest should handle complex queries', async () => {
    const result = await handleQueryTasksRequest({ 
      path: testVaultPath,
      query: `not done
priority is high`
    });
    
    expect(result.content).toBeDefined();
    
    // Parse the JSON string to verify the structure
    const tasks = JSON.parse(result.content[0].text);
    expect(Array.isArray(tasks)).toBe(true);
    
    // Should only have incomplete, high priority tasks
    expect(tasks.every((task: any) => 
      task.status === 'incomplete' && task.priority === 'high'
    )).toBe(true);
  });
});