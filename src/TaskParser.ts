/**
 * TaskParser - Inspired by the upstream Obsidian Tasks, but simplified for MCP
 */

import moment from 'moment';

// Interface for our task object
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

// Regular expressions based on Obsidian Tasks conventions
export class TaskRegex {
  // Matches a task line: indentation, list marker, checkbox, contents
  static readonly taskRegex = /^([\s\t>]*)([-*+]|[0-9]+[.)])( +\[(.)?\])(.*)/u;
  
  // Matches hashtags in task descriptions
  static readonly hashTags = /(^|\s)#[^ !@#$%^&*(),.?":{}|<>]+/g;
  
  // Date related regular expressions - matches emoji followed by date
  static readonly dueDateRegex = /🗓️\s?(\d{4}-\d{2}-\d{2})/;
  static readonly scheduledDateRegex = /⏳\s?(\d{4}-\d{2}-\d{2})/;
  static readonly startDateRegex = /🛫\s?(\d{4}-\d{2}-\d{2})/;
  static readonly createdDateRegex = /➕\s?(\d{4}-\d{2}-\d{2})/;
  
  // Priority emoji
  static readonly priorityRegex = /⏫|🔼|🔽/;
  
  // Recurrence
  static readonly recurrenceRegex = /🔁\s?(.*?)(?=(\s|$))/;
}

/**
 * Parse a task from a line of text
 */
export function parseTaskFromLine(line: string, filePath: string, lineNumber: number): Task | null {
  const match = line.match(TaskRegex.taskRegex);
  if (!match) {
    return null;
  }
  
  const statusChar = match[4];
  const description = match[5].trim();
  
  // Extract tags
  const tags = (description.match(TaskRegex.hashTags) || [])
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0);
  
  // Check for dates
  const dueMatch = description.match(TaskRegex.dueDateRegex);
  const scheduledMatch = description.match(TaskRegex.scheduledDateRegex);
  const startMatch = description.match(TaskRegex.startDateRegex);
  const createdMatch = description.match(TaskRegex.createdDateRegex);
  const recurrenceMatch = description.match(TaskRegex.recurrenceRegex);
  
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
  
  return task;
}

/**
 * Apply a filter function to a task
 */
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
      const today = moment().format('YYYY-MM-DD');
      return task.dueDate === today;
    }
    if (filter === 'due before today') {
      const today = moment().format('YYYY-MM-DD');
      return task.dueDate !== undefined && task.dueDate < today;
    }
    if (filter === 'due after today') {
      const today = moment().format('YYYY-MM-DD');
      return task.dueDate !== undefined && task.dueDate > today;
    }
    if (filter === 'no due date') {
      return task.dueDate === undefined;
    }
    if (filter === 'has due date') {
      return task.dueDate !== undefined;
    }
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
  
  // Boolean combinations with AND, OR, NOT
  if (filter.includes(' AND ')) {
    const parts = filter.split(' AND ');
    return parts.every(part => applyFilter(task, part));
  }
  
  if (filter.includes(' OR ')) {
    const parts = filter.split(' OR ');
    return parts.some(part => applyFilter(task, part));
  }
  
  if (filter.startsWith('NOT ')) {
    const subFilter = filter.substring(4);
    return !applyFilter(task, subFilter);
  }
  
  // If no filter match, default to including the task
  return true;
}

/**
 * Parse a query string into a set of filter lines
 */
export function parseQuery(queryText: string): string[] {
  // Split into lines and remove empty ones and comments
  return queryText.split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
}

/**
 * Apply a query to a list of tasks
 */
export function queryTasks(tasks: Task[], queryText: string): Task[] {
  const filters = parseQuery(queryText);
  
  // Apply all filters in sequence (AND logic between lines)
  return tasks.filter(task => {
    for (const filter of filters) {
      if (!applyFilter(task, filter)) {
        return false;
      }
    }
    return true;
  });
}