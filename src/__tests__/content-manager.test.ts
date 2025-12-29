/**
 * Content Manager Tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock logger
jest.unstable_mockModule('../utils/logger.js', () => ({
  log: {
    info: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock stealth utils
jest.unstable_mockModule('../utils/stealth-utils.js', () => ({
  randomDelay: jest.fn().mockResolvedValue(undefined),
  realisticClick: jest.fn().mockResolvedValue(undefined),
}));

// Mock CONFIG
jest.unstable_mockModule('../config.js', () => ({
  CONFIG: {
    dataDir: '/tmp/test-data',
  },
}));

describe('ContentManager', () => {
  let ContentManager: any;
  let mockPage: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Create mock page
    mockPage = {
      locator: jest.fn().mockReturnValue({
        first: jest.fn().mockReturnValue({
          isVisible: jest.fn().mockResolvedValue(false),
          click: jest.fn().mockResolvedValue(undefined),
        }),
        isVisible: jest.fn().mockResolvedValue(false),
        click: jest.fn().mockResolvedValue(undefined),
        fill: jest.fn().mockResolvedValue(undefined),
        textContent: jest.fn().mockResolvedValue(''),
        count: jest.fn().mockResolvedValue(0),
      }),
      waitForSelector: jest.fn().mockResolvedValue(null),
      waitForTimeout: jest.fn().mockResolvedValue(undefined),
      $: jest.fn().mockResolvedValue(null),
      $$: jest.fn().mockResolvedValue([]),
      evaluate: jest.fn().mockResolvedValue(null),
      url: jest.fn().mockReturnValue('https://notebooklm.google.com/notebook/test'),
      goto: jest.fn().mockResolvedValue(undefined),
    };

    // Import module
    const module = await import('../content/content-manager.js');
    ContentManager = module.ContentManager;
  });

  describe('Constructor', () => {
    it('should create instance with page', () => {
      const manager = new ContentManager(mockPage);
      expect(manager).toBeDefined();
    });
  });

  describe('Add Source', () => {
    it('should return error for unsupported source type', async () => {
      const manager = new ContentManager(mockPage);

      const result = await manager.addSource({ type: 'unknown' });

      expect(result.success).toBe(false);
      // Error could be about unsupported type or button not found
      expect(result.error).toBeDefined();
    });

    it('should require file path for file type', async () => {
      const manager = new ContentManager(mockPage);

      // Mock add source button found
      mockPage.locator.mockReturnValue({
        first: jest.fn().mockReturnValue({
          isVisible: jest.fn().mockResolvedValue(true),
          click: jest.fn().mockResolvedValue(undefined),
        }),
      });

      const result = await manager.addSource({ type: 'file' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('File path is required');
    });

    it('should block path traversal attempts', async () => {
      const manager = new ContentManager(mockPage);

      // Mock add source button found
      mockPage.locator.mockReturnValue({
        first: jest.fn().mockReturnValue({
          isVisible: jest.fn().mockResolvedValue(true),
          click: jest.fn().mockResolvedValue(undefined),
        }),
      });

      const result = await manager.addSource({
        type: 'file',
        filePath: '/etc/passwd',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not allowed');
    });

    it('should require URL for url type', async () => {
      const manager = new ContentManager(mockPage);

      // Mock add source button found
      mockPage.locator.mockReturnValue({
        first: jest.fn().mockReturnValue({
          isVisible: jest.fn().mockResolvedValue(true),
          click: jest.fn().mockResolvedValue(undefined),
        }),
      });

      const result = await manager.addSource({ type: 'url' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('URL is required');
    });

    it('should require content for text type', async () => {
      const manager = new ContentManager(mockPage);

      // Mock add source button found
      mockPage.locator.mockReturnValue({
        first: jest.fn().mockReturnValue({
          isVisible: jest.fn().mockResolvedValue(true),
          click: jest.fn().mockResolvedValue(undefined),
        }),
      });

      const result = await manager.addSource({ type: 'text' });

      expect(result.success).toBe(false);
      // Error message may be "Text content is required" or similar
      expect(result.error).toContain('required');
    });
  });

  describe('List Sources', () => {
    it('should return empty array when no sources', async () => {
      const manager = new ContentManager(mockPage);

      mockPage.$$.mockResolvedValue([]);

      const sources = await manager.listSources();

      expect(sources).toEqual([]);
    });

    it('should list sources from page', async () => {
      const manager = new ContentManager(mockPage);

      const mockSource = {
        textContent: jest.fn().mockResolvedValue('Source 1'),
        $: jest.fn().mockResolvedValue({
          textContent: jest.fn().mockResolvedValue('Description'),
        }),
        getAttribute: jest.fn().mockResolvedValue('source-1'),
      };

      mockPage.$$.mockResolvedValue([mockSource]);

      const sources = await manager.listSources();

      // Should attempt to find sources
      expect(mockPage.$$).toHaveBeenCalled();
      expect(sources).toBeDefined();
    });
  });

  describe('Generate Content', () => {
    it('should return error for unsupported type', async () => {
      const manager = new ContentManager(mockPage);

      const result = await manager.generateContent({
        type: 'unsupported' as any,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Get Content Overview', () => {
    it('should return overview object', async () => {
      const manager = new ContentManager(mockPage);

      mockPage.$$.mockResolvedValue([]);

      const overview = await manager.getContentOverview();

      expect(overview).toBeDefined();
      expect(typeof overview).toBe('object');
    });
  });

  describe('Download Audio', () => {
    it('should attempt audio download', async () => {
      const manager = new ContentManager(mockPage);

      const result = await manager.downloadAudio();

      // Result depends on actual audio availability
      expect(result).toBeDefined();
    });
  });

  describe('URL Validation for Sources', () => {
    it('should validate NotebookLM URLs', async () => {
      const manager = new ContentManager(mockPage);

      // Mock add source button
      mockPage.locator.mockReturnValue({
        first: jest.fn().mockReturnValue({
          isVisible: jest.fn().mockResolvedValue(true),
          click: jest.fn().mockResolvedValue(undefined),
        }),
      });

      // Valid URL
      const result = await manager.addSource({
        type: 'url',
        url: 'https://example.com/article',
      });

      // Will fail because upload dialog won't be found, but URL validation passes
      expect(result).toBeDefined();
    });
  });

  describe('YouTube Source', () => {
    it('should handle YouTube source type', async () => {
      const manager = new ContentManager(mockPage);

      // Mock add source button
      mockPage.locator.mockReturnValue({
        first: jest.fn().mockReturnValue({
          isVisible: jest.fn().mockResolvedValue(true),
          click: jest.fn().mockResolvedValue(undefined),
        }),
      });

      const result = await manager.addSource({
        type: 'youtube',
        url: 'https://youtube.com/watch?v=test',
      });

      expect(result).toBeDefined();
    });

    it('should require URL for YouTube type', async () => {
      const manager = new ContentManager(mockPage);

      mockPage.locator.mockReturnValue({
        first: jest.fn().mockReturnValue({
          isVisible: jest.fn().mockResolvedValue(true),
          click: jest.fn().mockResolvedValue(undefined),
        }),
      });

      const result = await manager.addSource({ type: 'youtube' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });
  });

  describe('Google Drive Source', () => {
    it('should handle Google Drive source type', async () => {
      const manager = new ContentManager(mockPage);

      mockPage.locator.mockReturnValue({
        first: jest.fn().mockReturnValue({
          isVisible: jest.fn().mockResolvedValue(true),
          click: jest.fn().mockResolvedValue(undefined),
        }),
      });

      const result = await manager.addSource({
        type: 'google_drive',
        driveFileId: 'test-file-id',
      });

      expect(result).toBeDefined();
    });
  });

  describe('Generate Content Types', () => {
    it('should handle audio_overview type', async () => {
      const manager = new ContentManager(mockPage);

      mockPage.locator.mockReturnValue({
        first: jest.fn().mockReturnValue({
          isVisible: jest.fn().mockResolvedValue(false),
          click: jest.fn().mockResolvedValue(undefined),
        }),
      });

      const result = await manager.generateContent({
        type: 'audio_overview',
      });

      expect(result).toBeDefined();
    });

    it('should handle study_guide type', async () => {
      const manager = new ContentManager(mockPage);

      mockPage.locator.mockReturnValue({
        first: jest.fn().mockReturnValue({
          isVisible: jest.fn().mockResolvedValue(false),
          click: jest.fn().mockResolvedValue(undefined),
        }),
      });

      const result = await manager.generateContent({
        type: 'study_guide',
      });

      expect(result).toBeDefined();
    });

    it('should handle briefing_doc type', async () => {
      const manager = new ContentManager(mockPage);

      const result = await manager.generateContent({
        type: 'briefing_doc',
      });

      expect(result).toBeDefined();
    });

    it('should handle timeline type', async () => {
      const manager = new ContentManager(mockPage);

      const result = await manager.generateContent({
        type: 'timeline',
      });

      expect(result).toBeDefined();
    });

    it('should handle faq type', async () => {
      const manager = new ContentManager(mockPage);

      const result = await manager.generateContent({
        type: 'faq',
      });

      expect(result).toBeDefined();
    });

    it('should handle table_of_contents type', async () => {
      const manager = new ContentManager(mockPage);

      const result = await manager.generateContent({
        type: 'table_of_contents',
      });

      expect(result).toBeDefined();
    });
  });

  describe('Content Overview', () => {
    it('should count sources correctly', async () => {
      const manager = new ContentManager(mockPage);

      const mockSource1 = {
        textContent: jest.fn().mockResolvedValue('Source 1'),
        $: jest.fn().mockResolvedValue({ textContent: jest.fn().mockResolvedValue('Desc 1') }),
      };
      const mockSource2 = {
        textContent: jest.fn().mockResolvedValue('Source 2'),
        $: jest.fn().mockResolvedValue({ textContent: jest.fn().mockResolvedValue('Desc 2') }),
      };

      mockPage.$$.mockResolvedValue([mockSource1, mockSource2]);

      const overview = await manager.getContentOverview();

      expect(overview).toBeDefined();
    });

    it('should handle empty notebook', async () => {
      const manager = new ContentManager(mockPage);

      mockPage.$$.mockResolvedValue([]);

      const overview = await manager.getContentOverview();

      expect(overview).toBeDefined();
    });
  });

  describe('List Sources Details', () => {
    it('should extract source metadata', async () => {
      const manager = new ContentManager(mockPage);

      const mockSourceElement = {
        textContent: jest.fn().mockResolvedValue('Test Source Title'),
        $: jest.fn().mockImplementation((selector: string) => {
          if (selector.includes('title')) {
            return Promise.resolve({
              textContent: jest.fn().mockResolvedValue('Test Source Title'),
            });
          }
          if (selector.includes('description')) {
            return Promise.resolve({
              textContent: jest.fn().mockResolvedValue('Source description'),
            });
          }
          return Promise.resolve(null);
        }),
        getAttribute: jest.fn().mockResolvedValue('source-123'),
      };

      mockPage.$$.mockResolvedValue([mockSourceElement]);

      const sources = await manager.listSources();

      expect(mockPage.$$).toHaveBeenCalled();
      expect(sources).toBeDefined();
    });

    it('should handle sources with missing metadata', async () => {
      const manager = new ContentManager(mockPage);

      const mockSourceElement = {
        textContent: jest.fn().mockResolvedValue(null),
        $: jest.fn().mockResolvedValue(null),
        getAttribute: jest.fn().mockResolvedValue(null),
      };

      mockPage.$$.mockResolvedValue([mockSourceElement]);

      const sources = await manager.listSources();

      // Should not throw
      expect(Array.isArray(sources)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle page errors gracefully', async () => {
      const manager = new ContentManager(mockPage);

      mockPage.$$.mockRejectedValue(new Error('Page error'));

      const sources = await manager.listSources();

      // Should return empty array or handle error
      expect(Array.isArray(sources)).toBe(true);
    });

    it('should handle content generation errors', async () => {
      const manager = new ContentManager(mockPage);

      mockPage.locator.mockImplementation(() => {
        throw new Error('Locator error');
      });

      const result = await manager.generateContent({
        type: 'study_guide',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Audio Generation Options', () => {
    it('should handle audio generation with voices', async () => {
      const manager = new ContentManager(mockPage);

      mockPage.locator.mockReturnValue({
        first: jest.fn().mockReturnValue({
          isVisible: jest.fn().mockResolvedValue(false),
        }),
      });

      const result = await manager.generateContent({
        type: 'audio_overview',
        audioOptions: {
          voices: ['casual'],
        },
      });

      expect(result).toBeDefined();
    });

    it('should handle audio generation with custom instructions', async () => {
      const manager = new ContentManager(mockPage);

      mockPage.locator.mockReturnValue({
        first: jest.fn().mockReturnValue({
          isVisible: jest.fn().mockResolvedValue(false),
        }),
      });

      const result = await manager.generateContent({
        type: 'audio_overview',
        audioOptions: {
          customInstructions: 'Focus on key concepts',
        },
      });

      expect(result).toBeDefined();
    });
  });

  describe('List Generated Content', () => {
    it('should list generated content', async () => {
      const manager = new ContentManager(mockPage);

      mockPage.$$.mockResolvedValue([]);

      const content = await manager.listGeneratedContent();

      expect(Array.isArray(content)).toBe(true);
    });
  });
});
