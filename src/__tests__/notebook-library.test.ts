/**
 * Tests for NotebookLM Library Manager
 * @module notebook-library.test
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { NotebookEntry, Library } from '../library/types.js';

// Create mock functions
const mockExistsSync = jest.fn();
const mockReadFileSync = jest.fn();
const mockWriteFileSync = jest.fn();

// Mock fs module
jest.unstable_mockModule('fs', () => ({
  default: {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    writeFileSync: mockWriteFileSync,
  },
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
}));

// Mock config
jest.unstable_mockModule('../config.js', () => ({
  CONFIG: {
    dataDir: '/tmp/test-data',
    notebookUrl: '',
    notebookDescription: '',
    notebookTopics: [],
    notebookContentTypes: [],
    notebookUseCases: [],
  },
}));

// Mock logger to avoid console output during tests
jest.unstable_mockModule('../utils/logger.js', () => ({
  log: {
    info: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
  },
}));

// Import after mocking
const { NotebookLibrary } = await import('../library/notebook-library.js');

describe('NotebookLibrary', () => {
  // Sample library data for tests
  const createMockLibrary = (notebooks: Partial<NotebookEntry>[] = []): Library => ({
    notebooks: notebooks.map((n, i) => ({
      id: n.id || `notebook-${i}`,
      url: n.url || `https://notebooklm.google.com/notebook/test-${i}`,
      name: n.name || `Test Notebook ${i}`,
      description: n.description || `Description for notebook ${i}`,
      topics: n.topics || ['topic1', 'topic2'],
      content_types: n.content_types || ['documentation'],
      use_cases: n.use_cases || ['testing'],
      added_at: n.added_at || '2024-01-01T00:00:00Z',
      last_used: n.last_used || '2024-01-01T00:00:00Z',
      use_count: n.use_count ?? 0,
      tags: n.tags || [],
    })) as NotebookEntry[],
    active_notebook_id: notebooks.length > 0 ? notebooks[0].id || 'notebook-0' : null,
    last_modified: '2024-01-01T00:00:00Z',
    version: '1.0.0',
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create empty library when no file exists', () => {
      mockExistsSync.mockReturnValue(false);
      mockWriteFileSync.mockImplementation(() => {});

      const library = new NotebookLibrary();

      expect(mockWriteFileSync).toHaveBeenCalled();
      expect(library.listNotebooks()).toEqual([]);
    });

    it('should load existing library from file', () => {
      const mockLibraryData = createMockLibrary([{ id: 'test-nb', name: 'Test Notebook' }]);

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockLibraryData));

      const library = new NotebookLibrary();

      expect(library.listNotebooks()).toHaveLength(1);
      expect(library.listNotebooks()[0].id).toBe('test-nb');
    });

    it('should create new library when file is corrupted', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('invalid json');
      mockWriteFileSync.mockImplementation(() => {});

      const library = new NotebookLibrary();

      expect(mockWriteFileSync).toHaveBeenCalled();
      expect(library.listNotebooks()).toEqual([]);
    });
  });

  describe('listNotebooks', () => {
    it('should return all notebooks', () => {
      const mockData = createMockLibrary([
        { id: 'nb-1', name: 'First' },
        { id: 'nb-2', name: 'Second' },
        { id: 'nb-3', name: 'Third' },
      ]);

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockData));

      const library = new NotebookLibrary();
      const notebooks = library.listNotebooks();

      expect(notebooks).toHaveLength(3);
      expect(notebooks.map((n) => n.id)).toEqual(['nb-1', 'nb-2', 'nb-3']);
    });

    it('should return empty array for empty library', () => {
      const mockData = createMockLibrary([]);

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockData));

      const library = new NotebookLibrary();

      expect(library.listNotebooks()).toEqual([]);
    });
  });

  describe('getNotebook', () => {
    it('should return notebook by ID', () => {
      const mockData = createMockLibrary([
        { id: 'target-nb', name: 'Target Notebook' },
        { id: 'other-nb', name: 'Other Notebook' },
      ]);

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockData));

      const library = new NotebookLibrary();
      const notebook = library.getNotebook('target-nb');

      expect(notebook).not.toBeNull();
      expect(notebook?.name).toBe('Target Notebook');
    });

    it('should return null for non-existent ID', () => {
      const mockData = createMockLibrary([{ id: 'existing-nb', name: 'Existing' }]);

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockData));

      const library = new NotebookLibrary();
      const notebook = library.getNotebook('non-existent');

      expect(notebook).toBeNull();
    });
  });

  describe('getActiveNotebook', () => {
    it('should return active notebook', () => {
      const mockData = createMockLibrary([
        { id: 'active-nb', name: 'Active' },
        { id: 'other-nb', name: 'Other' },
      ]);
      mockData.active_notebook_id = 'active-nb';

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockData));

      const library = new NotebookLibrary();
      const active = library.getActiveNotebook();

      expect(active).not.toBeNull();
      expect(active?.id).toBe('active-nb');
    });

    it('should return null when no active notebook', () => {
      const mockData = createMockLibrary([]);
      mockData.active_notebook_id = null;

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockData));

      const library = new NotebookLibrary();

      expect(library.getActiveNotebook()).toBeNull();
    });

    it('should return null when active ID points to non-existent notebook', () => {
      const mockData = createMockLibrary([{ id: 'existing', name: 'Existing' }]);
      mockData.active_notebook_id = 'deleted-notebook';

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockData));

      const library = new NotebookLibrary();

      expect(library.getActiveNotebook()).toBeNull();
    });
  });

  describe('selectNotebook', () => {
    it('should set notebook as active', () => {
      const mockData = createMockLibrary([
        { id: 'nb-1', name: 'First' },
        { id: 'nb-2', name: 'Second' },
      ]);
      mockData.active_notebook_id = 'nb-1';

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockData));
      mockWriteFileSync.mockImplementation(() => {});

      const library = new NotebookLibrary();
      const selected = library.selectNotebook('nb-2');

      expect(selected.id).toBe('nb-2');
      expect(mockWriteFileSync).toHaveBeenCalled();
    });

    it('should throw error for non-existent notebook', () => {
      const mockData = createMockLibrary([{ id: 'nb-1', name: 'First' }]);

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockData));

      const library = new NotebookLibrary();

      expect(() => library.selectNotebook('non-existent')).toThrow('Notebook not found');
    });

    it('should update last_used timestamp', () => {
      const mockData = createMockLibrary([
        { id: 'nb-1', name: 'First', last_used: '2020-01-01T00:00:00Z' },
      ]);

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockData));
      mockWriteFileSync.mockImplementation(() => {});

      const library = new NotebookLibrary();
      const selected = library.selectNotebook('nb-1');

      expect(new Date(selected.last_used).getTime()).toBeGreaterThan(
        new Date('2020-01-01T00:00:00Z').getTime()
      );
    });
  });

  describe('updateNotebook', () => {
    it('should update notebook fields', () => {
      const mockData = createMockLibrary([
        { id: 'nb-1', name: 'Original Name', description: 'Original desc' },
      ]);

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockData));
      mockWriteFileSync.mockImplementation(() => {});

      const library = new NotebookLibrary();
      const updated = library.updateNotebook({
        id: 'nb-1',
        name: 'New Name',
        description: 'New description',
      });

      expect(updated.name).toBe('New Name');
      expect(updated.description).toBe('New description');
    });

    it('should only update provided fields', () => {
      const mockData = createMockLibrary([
        {
          id: 'nb-1',
          name: 'Original',
          description: 'Keep this',
          topics: ['original-topic'],
        },
      ]);

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockData));
      mockWriteFileSync.mockImplementation(() => {});

      const library = new NotebookLibrary();
      const updated = library.updateNotebook({
        id: 'nb-1',
        name: 'New Name Only',
      });

      expect(updated.name).toBe('New Name Only');
      expect(updated.description).toBe('Keep this');
      expect(updated.topics).toEqual(['original-topic']);
    });

    it('should throw error for non-existent notebook', () => {
      const mockData = createMockLibrary([]);

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockData));

      const library = new NotebookLibrary();

      expect(() => library.updateNotebook({ id: 'non-existent' })).toThrow('Notebook not found');
    });
  });

  describe('removeNotebook', () => {
    it('should remove notebook from library', () => {
      const mockData = createMockLibrary([
        { id: 'nb-1', name: 'First' },
        { id: 'nb-2', name: 'Second' },
      ]);

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockData));
      mockWriteFileSync.mockImplementation(() => {});

      const library = new NotebookLibrary();
      const result = library.removeNotebook('nb-1');

      expect(result).toBe(true);
      expect(library.listNotebooks()).toHaveLength(1);
      expect(library.getNotebook('nb-1')).toBeNull();
    });

    it('should return false for non-existent notebook', () => {
      const mockData = createMockLibrary([{ id: 'nb-1', name: 'First' }]);

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockData));

      const library = new NotebookLibrary();
      const result = library.removeNotebook('non-existent');

      expect(result).toBe(false);
    });

    it('should update active notebook when removing active', () => {
      const mockData = createMockLibrary([
        { id: 'nb-1', name: 'First' },
        { id: 'nb-2', name: 'Second' },
      ]);
      mockData.active_notebook_id = 'nb-1';

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockData));
      mockWriteFileSync.mockImplementation(() => {});

      const library = new NotebookLibrary();
      library.removeNotebook('nb-1');

      // After removing active, should select next available
      const active = library.getActiveNotebook();
      expect(active?.id).toBe('nb-2');
    });

    it('should set active to null when removing last notebook', () => {
      const mockData = createMockLibrary([{ id: 'only-one', name: 'Only One' }]);
      mockData.active_notebook_id = 'only-one';

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockData));
      mockWriteFileSync.mockImplementation(() => {});

      const library = new NotebookLibrary();
      library.removeNotebook('only-one');

      expect(library.getActiveNotebook()).toBeNull();
    });
  });

  describe('incrementUseCount', () => {
    it('should increment use count', () => {
      const mockData = createMockLibrary([{ id: 'nb-1', name: 'First', use_count: 5 }]);

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockData));
      mockWriteFileSync.mockImplementation(() => {});

      const library = new NotebookLibrary();
      const updated = library.incrementUseCount('nb-1');

      expect(updated?.use_count).toBe(6);
    });

    it('should update last_used timestamp', () => {
      const mockData = createMockLibrary([
        { id: 'nb-1', name: 'First', last_used: '2020-01-01T00:00:00Z' },
      ]);

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockData));
      mockWriteFileSync.mockImplementation(() => {});

      const library = new NotebookLibrary();
      const updated = library.incrementUseCount('nb-1');

      expect(new Date(updated!.last_used).getTime()).toBeGreaterThan(
        new Date('2020-01-01T00:00:00Z').getTime()
      );
    });

    it('should return null for non-existent notebook', () => {
      const mockData = createMockLibrary([]);

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockData));

      const library = new NotebookLibrary();
      const result = library.incrementUseCount('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      const mockData = createMockLibrary([
        { id: 'nb-1', name: 'First', use_count: 10 },
        { id: 'nb-2', name: 'Second', use_count: 25 },
        { id: 'nb-3', name: 'Third', use_count: 5 },
      ]);
      mockData.active_notebook_id = 'nb-1';

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockData));

      const library = new NotebookLibrary();
      const stats = library.getStats();

      expect(stats.total_notebooks).toBe(3);
      expect(stats.active_notebook).toBe('nb-1');
      expect(stats.most_used_notebook).toBe('nb-2');
      expect(stats.total_queries).toBe(40); // 10 + 25 + 5
    });

    it('should handle empty library', () => {
      const mockData = createMockLibrary([]);

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockData));

      const library = new NotebookLibrary();
      const stats = library.getStats();

      expect(stats.total_notebooks).toBe(0);
      expect(stats.active_notebook).toBeNull();
      expect(stats.most_used_notebook).toBeNull();
      expect(stats.total_queries).toBe(0);
    });

    it('should identify most used notebook correctly', () => {
      const mockData = createMockLibrary([
        { id: 'low', use_count: 1 },
        { id: 'high', use_count: 100 },
        { id: 'medium', use_count: 50 },
      ]);

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockData));

      const library = new NotebookLibrary();
      const stats = library.getStats();

      expect(stats.most_used_notebook).toBe('high');
    });
  });

  describe('searchNotebooks', () => {
    const mockData = createMockLibrary([
      {
        id: 'python-docs',
        name: 'Python Documentation',
        description: 'Official Python language docs',
        topics: ['python', 'programming', 'scripting'],
        tags: ['language', 'official'],
      },
      {
        id: 'react-guide',
        name: 'React Guide',
        description: 'Learn React framework',
        topics: ['react', 'javascript', 'frontend'],
        tags: ['framework', 'web'],
      },
      {
        id: 'ml-course',
        name: 'Machine Learning Course',
        description: 'Introduction to ML and AI',
        topics: ['machine learning', 'ai', 'data science'],
        tags: ['course', 'education'],
      },
    ]);

    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(mockData));
    });

    it('should search by name', () => {
      const library = new NotebookLibrary();
      const results = library.searchNotebooks('Python');

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('python-docs');
    });

    it('should search by description', () => {
      const library = new NotebookLibrary();
      const results = library.searchNotebooks('framework');

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('react-guide');
    });

    it('should search by topics', () => {
      const library = new NotebookLibrary();
      const results = library.searchNotebooks('javascript');

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('react-guide');
    });

    it('should search by tags', () => {
      const library = new NotebookLibrary();
      const results = library.searchNotebooks('education');

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('ml-course');
    });

    it('should be case-insensitive', () => {
      const library = new NotebookLibrary();

      expect(library.searchNotebooks('PYTHON')).toHaveLength(1);
      expect(library.searchNotebooks('python')).toHaveLength(1);
      expect(library.searchNotebooks('PyThOn')).toHaveLength(1);
    });

    it('should return multiple matches', () => {
      const library = new NotebookLibrary();
      const results = library.searchNotebooks('a'); // matches many things

      expect(results.length).toBeGreaterThan(1);
    });

    it('should return empty array for no matches', () => {
      const library = new NotebookLibrary();
      const results = library.searchNotebooks('nonexistent-term-xyz');

      expect(results).toEqual([]);
    });

    it('should handle partial matches', () => {
      const library = new NotebookLibrary();
      const results = library.searchNotebooks('program');

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('python-docs');
    });
  });

  describe('URL validation (via addNotebook)', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(createMockLibrary([])));
      mockWriteFileSync.mockImplementation(() => {});
    });

    it('should reject invalid URL format', async () => {
      const library = new NotebookLibrary();

      await expect(
        library.addNotebook({
          url: 'not-a-url',
          name: 'Test',
          description: 'Test',
          topics: ['test'],
        })
      ).rejects.toThrow('Invalid NotebookLM URL');
    });

    it('should reject non-NotebookLM URLs', async () => {
      const library = new NotebookLibrary();

      await expect(
        library.addNotebook({
          url: 'https://google.com/notebook/abc',
          name: 'Test',
          description: 'Test',
          topics: ['test'],
        })
      ).rejects.toThrow('Invalid NotebookLM URL');
    });

    it('should reject URLs without notebook path', async () => {
      const library = new NotebookLibrary();

      await expect(
        library.addNotebook({
          url: 'https://notebooklm.google.com/',
          name: 'Test',
          description: 'Test',
          topics: ['test'],
        })
      ).rejects.toThrow('Invalid NotebookLM URL');
    });

    it('should reject URLs with empty notebook ID', async () => {
      const library = new NotebookLibrary();

      await expect(
        library.addNotebook({
          url: 'https://notebooklm.google.com/notebook/',
          name: 'Test',
          description: 'Test',
          topics: ['test'],
        })
      ).rejects.toThrow('Invalid NotebookLM URL');
    });
  });

  describe('ID generation (via addNotebook)', () => {
    beforeEach(() => {
      mockExistsSync.mockReturnValue(true);
      mockWriteFileSync.mockImplementation(() => {});
    });

    it('should generate slug from name', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(createMockLibrary([])));

      const library = new NotebookLibrary();
      const notebook = await library.addNotebook({
        url: 'https://notebooklm.google.com/notebook/test-123',
        name: 'My Test Notebook',
        description: 'Test',
        topics: ['test'],
      });

      expect(notebook.id).toBe('my-test-notebook');
    });

    it('should handle special characters in name', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(createMockLibrary([])));

      const library = new NotebookLibrary();
      const notebook = await library.addNotebook({
        url: 'https://notebooklm.google.com/notebook/test-123',
        name: 'Test! @#$% Notebook',
        description: 'Test',
        topics: ['test'],
      });

      expect(notebook.id).toBe('test-notebook');
    });

    it('should truncate long names to 30 characters', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify(createMockLibrary([])));

      const library = new NotebookLibrary();
      const notebook = await library.addNotebook({
        url: 'https://notebooklm.google.com/notebook/test-123',
        name: 'This Is A Very Long Notebook Name That Should Be Truncated',
        description: 'Test',
        topics: ['test'],
      });

      expect(notebook.id.length).toBeLessThanOrEqual(30);
    });

    it('should generate unique IDs when duplicates exist', async () => {
      const existingData = createMockLibrary([{ id: 'test-notebook', name: 'Test Notebook' }]);
      mockReadFileSync.mockReturnValue(JSON.stringify(existingData));

      const library = new NotebookLibrary();
      const notebook = await library.addNotebook({
        url: 'https://notebooklm.google.com/notebook/test-456',
        name: 'Test Notebook New', // Would generate 'test-notebook' base
        description: 'Test',
        topics: ['test'],
      });

      // Should add suffix to make unique
      expect(notebook.id).not.toBe('test-notebook');
    });

    it('should reject duplicate names', async () => {
      const existingData = createMockLibrary([{ id: 'existing', name: 'Existing Name' }]);
      mockReadFileSync.mockReturnValue(JSON.stringify(existingData));

      const library = new NotebookLibrary();

      await expect(
        library.addNotebook({
          url: 'https://notebooklm.google.com/notebook/test-123',
          name: 'Existing Name',
          description: 'Test',
          topics: ['test'],
        })
      ).rejects.toThrow("A notebook with the name 'Existing Name' already exists");
    });
  });
});
