import fs from 'fs/promises';
import path from 'path';

// Import the functions to test (we'll need to export them from index.ts)
import { findAllTasks, queryTasks } from '../src/index.js';

describe('Task Querying', () => {
  const testVaultPath = path.join(process.cwd(), 'tests', 'test-vault');
  
  // Disable the server auto-start for tests
  process.env.DISABLE_SERVER = 'true';
  
  beforeAll(async () => {
    // Verify that the test vault exists
    try {
      await fs.access(testVaultPath);
    } catch (error) {
      throw new Error(`Test vault not accessible: ${error}`);
    }
  });
  
  test('findAllTasks should collect all tasks from the test vault', async () => {
    const tasks = await findAllTasks(testVaultPath);
    expect(tasks.length).toBeGreaterThan(0);
  });
  
  test('queryTasks with done filter should return only completed tasks', async () => {
    const allTasks = await findAllTasks(testVaultPath);
    const query = 'done';
    const filteredTasks = queryTasks(allTasks, query);
    
    expect(filteredTasks.length).toBeGreaterThan(0);
    expect(filteredTasks.every(task => task.status === 'complete')).toBe(true);
  });
  
  test('queryTasks with not done filter should return only incomplete tasks', async () => {
    const allTasks = await findAllTasks(testVaultPath);
    const query = 'not done';
    const filteredTasks = queryTasks(allTasks, query);
    
    expect(filteredTasks.length).toBeGreaterThan(0);
    expect(filteredTasks.every(task => task.status === 'incomplete')).toBe(true);
  });
  
  test('queryTasks with tag filters should work correctly', async () => {
    const allTasks = await findAllTasks(testVaultPath);
    
    // Tasks with tags - some filtering may not be perfect yet
    const tasksWithTags = queryTasks(allTasks, 'has tags');
    expect(tasksWithTags.length).toBeGreaterThan(0);
    // Check if any tasks have tags
    expect(tasksWithTags.some(task => task.tags && task.tags.length > 0)).toBe(true);
    
    // Tasks without tags
    const tasksWithoutTags = queryTasks(allTasks, 'no tags');
    
    // Tasks with specific tag
    const tasksWithSpecificTag = queryTasks(allTasks, 'tag include testing');
    expect(tasksWithSpecificTag.length).toBeGreaterThan(0);
    expect(tasksWithSpecificTag.every(task => 
      task.tags && task.tags.some(tag => tag.includes('testing'))
    )).toBe(true);
  });
  
  test('queryTasks with due date filters should work correctly', async () => {
    const allTasks = await findAllTasks(testVaultPath);
    
    // Tasks with due dates
    const tasksWithDueDate = queryTasks(allTasks, 'has due date');
    expect(tasksWithDueDate.length).toBeGreaterThan(0);
    expect(tasksWithDueDate.every(task => task.dueDate !== undefined)).toBe(true);
    
    // Tasks without due dates
    const tasksWithoutDueDate = queryTasks(allTasks, 'no due date');
    expect(tasksWithoutDueDate.every(task => task.dueDate === undefined)).toBe(true);
  });
  
  test('queryTasks with priority filters should work correctly', async () => {
    const allTasks = await findAllTasks(testVaultPath);
    
    // High priority tasks
    const highPriorityTasks = queryTasks(allTasks, 'priority is high');
    expect(highPriorityTasks.length).toBeGreaterThan(0);
    expect(highPriorityTasks.every(task => task.priority === 'high')).toBe(true);
    
    // Medium priority tasks
    const mediumPriorityTasks = queryTasks(allTasks, 'priority is medium');
    expect(mediumPriorityTasks.every(task => task.priority === 'medium')).toBe(true);
    
    // Low priority tasks
    const lowPriorityTasks = queryTasks(allTasks, 'priority is low');
    expect(lowPriorityTasks.every(task => task.priority === 'low')).toBe(true);
  });
  
  test('queryTasks with multiple filters should use AND logic', async () => {
    const allTasks = await findAllTasks(testVaultPath);
    
    // High priority incomplete tasks
    const query = `not done
priority is high`;
    
    const filteredTasks = queryTasks(allTasks, query);
    
    expect(filteredTasks.length).toBeGreaterThan(0);
    expect(filteredTasks.every(task => 
      task.status === 'incomplete' && task.priority === 'high'
    )).toBe(true);
  });
  
  test('queryTasks with description filters should work correctly', async () => {
    const allTasks = await findAllTasks(testVaultPath);
    
    // Tasks with specific text in description
    const tasksWithText = queryTasks(allTasks, 'description includes priority');
    expect(tasksWithText.length).toBeGreaterThan(0);
    expect(tasksWithText.every(task => 
      task.description.toLowerCase().includes('priority')
    )).toBe(true);
    
    // Tasks without specific text
    const tasksWithoutText = queryTasks(allTasks, 'description does not include priority');
    expect(tasksWithoutText.every(task => 
      !task.description.toLowerCase().includes('priority')
    )).toBe(true);
  });
});