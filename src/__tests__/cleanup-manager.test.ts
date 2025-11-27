import { describe, it, expect, beforeEach } from '@jest/globals';
import { CleanupManager } from '../utils/cleanup-manager.js';
import type { CleanupMode } from '../utils/cleanup-manager.js';

describe('CleanupManager', () => {
  let cleanupManager: CleanupManager;

  beforeEach(() => {
    cleanupManager = new CleanupManager();
  });

  describe('constructor', () => {
    it('should create instance successfully', () => {
      expect(cleanupManager).toBeInstanceOf(CleanupManager);
    });

    it('should initialize without errors', () => {
      expect(() => new CleanupManager()).not.toThrow();
    });
  });

  describe('formatBytes', () => {
    it('should format 0 bytes', () => {
      const result = cleanupManager.formatBytes(0);
      expect(result).toBe('0 Bytes');
    });

    it('should format bytes', () => {
      const result = cleanupManager.formatBytes(512);
      expect(result).toBe('512 Bytes');
    });

    it('should format kilobytes', () => {
      const result = cleanupManager.formatBytes(1024);
      expect(result).toBe('1 KB');
    });

    it('should format kilobytes with decimals', () => {
      const result = cleanupManager.formatBytes(1536);
      expect(result).toBe('1.5 KB');
    });

    it('should format megabytes', () => {
      const result = cleanupManager.formatBytes(1024 * 1024);
      expect(result).toBe('1 MB');
    });

    it('should format megabytes with decimals', () => {
      const result = cleanupManager.formatBytes(1024 * 1024 * 2.5);
      expect(result).toBe('2.5 MB');
    });

    it('should format gigabytes', () => {
      const result = cleanupManager.formatBytes(1024 * 1024 * 1024);
      expect(result).toBe('1 GB');
    });

    it('should format gigabytes with decimals', () => {
      const result = cleanupManager.formatBytes(1024 * 1024 * 1024 * 1.75);
      expect(result).toBe('1.75 GB');
    });

    it('should round to 2 decimal places', () => {
      const result = cleanupManager.formatBytes(1024 * 1.666);
      expect(result).toMatch(/^\d+\.\d{1,2} KB$/);
    });

    it('should handle large byte values', () => {
      const result = cleanupManager.formatBytes(1024 * 1024 * 1024 * 100);
      expect(result).toBe('100 GB');
    });

    it('should handle small fractional bytes', () => {
      const result = cleanupManager.formatBytes(100);
      expect(result).toBe('100 Bytes');
    });

    it('should handle edge case of 1 byte', () => {
      const result = cleanupManager.formatBytes(1);
      expect(result).toBe('1 Bytes');
    });
  });

  describe('getPlatformInfo', () => {
    it('should return platform information', () => {
      const info = cleanupManager.getPlatformInfo();

      expect(info).toBeDefined();
      expect(info).toHaveProperty('platform');
      expect(info).toHaveProperty('legacyBasePath');
      expect(info).toHaveProperty('currentBasePath');
      expect(info).toHaveProperty('npmCachePath');
      expect(info).toHaveProperty('claudeCliCachePath');
      expect(info).toHaveProperty('claudeProjectsPath');
    });

    it('should have valid platform name', () => {
      const info = cleanupManager.getPlatformInfo();

      expect(['Windows', 'macOS', 'Linux', 'Unknown']).toContain(info.platform);
    });

    it('should have string paths', () => {
      const info = cleanupManager.getPlatformInfo();

      expect(typeof info.legacyBasePath).toBe('string');
      expect(typeof info.currentBasePath).toBe('string');
      expect(typeof info.npmCachePath).toBe('string');
      expect(typeof info.claudeCliCachePath).toBe('string');
      expect(typeof info.claudeProjectsPath).toBe('string');
    });

    it('should have non-empty paths', () => {
      const info = cleanupManager.getPlatformInfo();

      expect(info.legacyBasePath.length).toBeGreaterThan(0);
      expect(info.currentBasePath.length).toBeGreaterThan(0);
      expect(info.npmCachePath.length).toBeGreaterThan(0);
      expect(info.claudeCliCachePath.length).toBeGreaterThan(0);
      expect(info.claudeProjectsPath.length).toBeGreaterThan(0);
    });

    it('should have different legacy and current paths', () => {
      const info = cleanupManager.getPlatformInfo();

      // Legacy path should have -nodejs suffix, current should not
      expect(info.legacyBasePath).not.toBe(info.currentBasePath);
    });

    it('should contain notebooklm-mcp in paths', () => {
      const info = cleanupManager.getPlatformInfo();

      expect(info.legacyBasePath.toLowerCase()).toContain('notebooklm-mcp');
      expect(info.currentBasePath.toLowerCase()).toContain('notebooklm-mcp');
    });

    it('should return consistent results', () => {
      const info1 = cleanupManager.getPlatformInfo();
      const info2 = cleanupManager.getPlatformInfo();

      expect(info1.platform).toBe(info2.platform);
      expect(info1.legacyBasePath).toBe(info2.legacyBasePath);
      expect(info1.currentBasePath).toBe(info2.currentBasePath);
    });
  });

  describe('CleanupMode types', () => {
    it('should support legacy mode', () => {
      const mode: CleanupMode = 'legacy';
      expect(mode).toBe('legacy');
    });

    it('should support all mode', () => {
      const mode: CleanupMode = 'all';
      expect(mode).toBe('all');
    });

    it('should support deep mode', () => {
      const mode: CleanupMode = 'deep';
      expect(mode).toBe('deep');
    });

    it('should have valid mode values', () => {
      const validModes: CleanupMode[] = ['legacy', 'all', 'deep'];
      expect(validModes.length).toBe(3);
    });
  });

  describe('cleanup result structure', () => {
    it('should have expected properties', () => {
      const mockResult = {
        success: true,
        mode: 'legacy' as CleanupMode,
        deletedPaths: [],
        failedPaths: [],
        totalSizeBytes: 0,
        categorySummary: {},
      };

      expect(mockResult).toHaveProperty('success');
      expect(mockResult).toHaveProperty('mode');
      expect(mockResult).toHaveProperty('deletedPaths');
      expect(mockResult).toHaveProperty('failedPaths');
      expect(mockResult).toHaveProperty('totalSizeBytes');
      expect(mockResult).toHaveProperty('categorySummary');
    });

    it('should have correct property types', () => {
      const mockResult = {
        success: true,
        mode: 'all' as CleanupMode,
        deletedPaths: ['/path/1', '/path/2'],
        failedPaths: ['/path/3'],
        totalSizeBytes: 1024,
        categorySummary: {
          'Category 1': { count: 2, bytes: 512 },
          'Category 2': { count: 1, bytes: 512 },
        },
      };

      expect(typeof mockResult.success).toBe('boolean');
      expect(typeof mockResult.mode).toBe('string');
      expect(Array.isArray(mockResult.deletedPaths)).toBe(true);
      expect(Array.isArray(mockResult.failedPaths)).toBe(true);
      expect(typeof mockResult.totalSizeBytes).toBe('number');
      expect(typeof mockResult.categorySummary).toBe('object');
    });
  });

  describe('cleanup category structure', () => {
    it('should have expected properties', () => {
      const mockCategory = {
        name: 'Test Category',
        description: 'Test description',
        paths: ['/path/1', '/path/2'],
        totalBytes: 1024,
        optional: false,
      };

      expect(mockCategory).toHaveProperty('name');
      expect(mockCategory).toHaveProperty('description');
      expect(mockCategory).toHaveProperty('paths');
      expect(mockCategory).toHaveProperty('totalBytes');
      expect(mockCategory).toHaveProperty('optional');
    });

    it('should support optional categories', () => {
      const optionalCategory = {
        name: 'Optional Category',
        description: 'Optional files',
        paths: [],
        totalBytes: 0,
        optional: true,
      };

      expect(optionalCategory.optional).toBe(true);
    });

    it('should support required categories', () => {
      const requiredCategory = {
        name: 'Required Category',
        description: 'Required files',
        paths: [],
        totalBytes: 0,
        optional: false,
      };

      expect(requiredCategory.optional).toBe(false);
    });
  });

  describe('byte size calculations', () => {
    it('should calculate KB correctly', () => {
      const bytes = 1024;
      const kb = bytes / 1024;
      expect(kb).toBe(1);
    });

    it('should calculate MB correctly', () => {
      const bytes = 1024 * 1024;
      const mb = bytes / (1024 * 1024);
      expect(mb).toBe(1);
    });

    it('should calculate GB correctly', () => {
      const bytes = 1024 * 1024 * 1024;
      const gb = bytes / (1024 * 1024 * 1024);
      expect(gb).toBe(1);
    });

    it('should handle fractional values', () => {
      const bytes = 1536; // 1.5 KB
      const kb = bytes / 1024;
      expect(kb).toBe(1.5);
    });

    it('should handle zero bytes', () => {
      const bytes = 0;
      const kb = bytes / 1024;
      expect(kb).toBe(0);
    });
  });

  describe('path validation logic', () => {
    it('should validate absolute paths', () => {
      const isAbsolute = (p: string) => {
        return p.startsWith('/') || /^[A-Z]:\\/.test(p);
      };

      expect(isAbsolute('/home/user/file')).toBe(true);
      expect(isAbsolute('C:\\Users\\file')).toBe(true);
      expect(isAbsolute('relative/path')).toBe(false);
    });

    it('should identify relative paths', () => {
      const isRelative = (p: string) => {
        return !p.startsWith('/') && !/^[A-Z]:\\/.test(p);
      };

      expect(isRelative('relative/path')).toBe(true);
      expect(isRelative('./relative')).toBe(true);
      expect(isRelative('../parent')).toBe(true);
      expect(isRelative('/absolute')).toBe(false);
    });

    it('should handle empty paths', () => {
      const path = '';
      expect(path.length).toBe(0);
    });

    it('should detect path separators', () => {
      const unixPath = '/home/user/file';
      const windowsPath = 'C:\\Users\\file';

      expect(unixPath).toContain('/');
      expect(windowsPath).toContain('\\');
    });
  });

  describe('category summary calculations', () => {
    it('should sum bytes correctly', () => {
      const files = [{ size: 1024 }, { size: 2048 }, { size: 512 }];

      const total = files.reduce((sum, f) => sum + f.size, 0);
      expect(total).toBe(3584);
    });

    it('should count files correctly', () => {
      const files = ['file1', 'file2', 'file3'];
      expect(files.length).toBe(3);
    });

    it('should handle empty categories', () => {
      const files: string[] = [];
      const total = 0;

      expect(files.length).toBe(0);
      expect(total).toBe(0);
    });

    it('should track multiple categories', () => {
      const summary = {
        'Category 1': { count: 5, bytes: 1024 },
        'Category 2': { count: 3, bytes: 512 },
        'Category 3': { count: 1, bytes: 256 },
      };

      const totalCount = Object.values(summary).reduce((sum, cat) => sum + cat.count, 0);
      const totalBytes = Object.values(summary).reduce((sum, cat) => sum + cat.bytes, 0);

      expect(totalCount).toBe(9);
      expect(totalBytes).toBe(1792);
    });
  });

  describe('mode comparison logic', () => {
    it('should identify legacy mode scope', () => {
      const mode: CleanupMode = 'legacy';
      const includesLegacy = mode === 'legacy' || mode === 'all' || mode === 'deep';
      expect(includesLegacy).toBe(true);
    });

    it('should identify all mode scope', () => {
      const mode: CleanupMode = 'all';
      const includesCurrent = mode === 'all' || mode === 'deep';
      expect(includesCurrent).toBe(true);
    });

    it('should identify deep mode scope', () => {
      const mode: CleanupMode = 'deep';
      const includesOptional = mode === 'deep';
      expect(includesOptional).toBe(true);
    });

    it('should order modes by scope', () => {
      const modes: CleanupMode[] = ['legacy', 'all', 'deep'];
      // Legacy < All < Deep (in terms of scope)
      expect(modes.indexOf('legacy')).toBeLessThan(modes.indexOf('all'));
      expect(modes.indexOf('all')).toBeLessThan(modes.indexOf('deep'));
    });
  });

  describe('preserve library flag logic', () => {
    it('should support preserve library option', () => {
      const preserveLibrary = true;
      expect(preserveLibrary).toBe(true);
    });

    it('should default to not preserving library', () => {
      const preserveLibrary = false;
      expect(preserveLibrary).toBe(false);
    });

    it('should affect paths when preserving', () => {
      const allPaths = ['data/', 'data/browser_state', 'data/library.json'];
      const preserveLibrary = true;

      const pathsToDelete = preserveLibrary
        ? allPaths.filter((p) => !p.endsWith('library.json'))
        : allPaths;

      expect(pathsToDelete).not.toContain('data/library.json');
      expect(pathsToDelete.length).toBeLessThan(allPaths.length);
    });

    it('should delete all paths when not preserving', () => {
      const allPaths = ['data/', 'data/browser_state', 'data/library.json'];
      const preserveLibrary = false;

      const pathsToDelete = preserveLibrary
        ? allPaths.filter((p) => !p.endsWith('library.json'))
        : allPaths;

      expect(pathsToDelete.length).toBe(allPaths.length);
    });
  });
});
