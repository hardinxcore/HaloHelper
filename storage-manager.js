/**
 * Advanced Storage Manager for HaloPSA Extension
 * Provides robust localStorage management with error handling, compression, and performance optimization
 */

class StorageManager {
  constructor() {
    this.storageKeys = {
      PINNED_ARTICLES: 'haloPinnedArticles',
      STORED_SEARCH_RESULTS: 'haloStoredSearchResults',
      DARK_MODE: 'haloDarkMode',
      STORAGE_VERSION: 'haloStorageVersion'
    };
    
    this.currentVersion = '2.0';
    this.maxStoredResults = 5;
    this.maxPinnedArticles = 100; // Prevent unlimited growth
    this.compressionThreshold = 1024; // Compress data larger than 1KB
    
    // Initialize storage
    this.initializeStorage();
  }

  /**
   * Initialize storage with version checking and migration
   */
  initializeStorage() {
    try {
      const storedVersion = this.getStorageVersion();
      
      if (!storedVersion || storedVersion !== this.currentVersion) {
        console.log(`Storage version changed from ${storedVersion} to ${this.currentVersion}`);
        this.migrateStorage(storedVersion);
        this.setStorageVersion(this.currentVersion);
      }
      
      // Clean up old or corrupted data
      this.cleanupStorage();
      
    } catch (error) {
      console.error('Storage initialization failed:', error);
      this.handleStorageError(error);
    }
  }

  /**
   * Get storage version
   */
  getStorageVersion() {
    return this.safeGet(this.storageKeys.STORAGE_VERSION);
  }

  /**
   * Set storage version
   */
  setStorageVersion(version) {
    this.safeSet(this.storageKeys.STORAGE_VERSION, version);
  }

  /**
   * Migrate storage from old versions
   */
  migrateStorage(oldVersion) {
    try {
      if (!oldVersion || oldVersion === '1.0') {
        // Migrate from version 1.0 to 2.0
        this.migrateFromV1ToV2();
      }
      
      console.log(`Storage migration completed from ${oldVersion} to ${this.currentVersion}`);
    } catch (error) {
      console.error('Storage migration failed:', error);
      // If migration fails, clear storage to prevent corruption
      this.clearAllStorage();
    }
  }

  /**
   * Migrate from version 1.0 to 2.0
   */
  migrateFromV1ToV2() {
    // Add timestamps to pinned articles if missing
    const pinnedArticles = this.getPinnedArticles();
    const updatedArticles = pinnedArticles.map(article => {
      if (!article.pinnedDate) {
        article.pinnedDate = new Date().toISOString();
      }
      return article;
    });
    
    if (updatedArticles.length > 0) {
      this.setPinnedArticles(updatedArticles);
    }
  }

  /**
   * Safe localStorage get with error handling
   */
  safeGet(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return defaultValue;
      
      // Check if data is compressed
      if (this.isCompressed(item)) {
        return this.decompress(item);
      }
      
      return JSON.parse(item);
    } catch (error) {
      console.error(`Failed to get storage item ${key}:`, error);
      this.handleStorageError(error, key);
      return defaultValue;
    }
  }

  /**
   * Safe localStorage set with error handling and compression
   */
  safeSet(key, value) {
    try {
      const serialized = JSON.stringify(value);
      
      // Compress large data
      const dataToStore = serialized.length > this.compressionThreshold 
        ? this.compress(serialized) 
        : serialized;
      
      localStorage.setItem(key, dataToStore);
      
      // Check if we're approaching storage limits
      this.checkStorageQuota();
      
    } catch (error) {
      console.error(`Failed to set storage item ${key}:`, error);
      this.handleStorageError(error, key, value);
    }
  }

  /**
   * Safe localStorage remove
   */
  safeRemove(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Failed to remove storage item ${key}:`, error);
      this.handleStorageError(error, key);
    }
  }

  /**
   * Check if data is compressed
   */
  isCompressed(data) {
    try {
      return data.startsWith('COMPRESSED:');
    } catch {
      return false;
    }
  }

  /**
   * Simple compression using base64 encoding
   */
  compress(data) {
    try {
      // Simple compression - in production, consider using a proper compression library
      const compressed = btoa(unescape(encodeURIComponent(data)));
      return `COMPRESSED:${compressed}`;
    } catch (error) {
      console.error('Compression failed:', error);
      return data; // Return original data if compression fails
    }
  }

  /**
   * Decompress data
   */
  decompress(data) {
    try {
      const compressedData = data.replace('COMPRESSED:', '');
      return JSON.parse(decodeURIComponent(escape(atob(compressedData))));
    } catch (error) {
      console.error('Decompression failed:', error);
      return null;
    }
  }

  /**
   * Check storage quota and clean up if necessary
   */
  checkStorageQuota() {
    try {
      // Estimate storage usage
      let totalSize = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          totalSize += localStorage[key].length;
        }
      }
      
      // If approaching limit (5MB), clean up old data
      if (totalSize > 4 * 1024 * 1024) { // 4MB threshold
        console.warn('Storage quota approaching limit, cleaning up old data');
        this.cleanupOldData();
      }
    } catch (error) {
      console.error('Storage quota check failed:', error);
    }
  }

  /**
   * Clean up old stored search results
   */
  cleanupOldData() {
    try {
      const storedResults = this.getStoredSearchResults();
      
      // Remove duplicate/similar queries
      const deduplicatedResults = this.removeDuplicateQueries(storedResults);
      
      if (deduplicatedResults.length !== storedResults.length) {
        console.log(`Removed ${storedResults.length - deduplicatedResults.length} duplicate queries`);
        this.setStoredSearchResults(deduplicatedResults);
      }
      
      // Limit to max results
      if (deduplicatedResults.length > this.maxStoredResults) {
        const trimmed = deduplicatedResults.slice(0, this.maxStoredResults);
        this.setStoredSearchResults(trimmed);
      }
      
      // Clean up old pinned articles
      const pinnedArticles = this.getPinnedArticles();
      if (pinnedArticles.length > this.maxPinnedArticles) {
        // Keep only the most recently pinned articles
        const sorted = pinnedArticles.sort((a, b) => 
          new Date(b.pinnedDate || 0) - new Date(a.pinnedDate || 0)
        );
        const trimmed = sorted.slice(0, this.maxPinnedArticles);
        this.setPinnedArticles(trimmed);
      }
    } catch (error) {
      console.error('Data cleanup failed:', error);
    }
  }

  /**
   * Remove duplicate/similar queries from stored results
   */
  removeDuplicateQueries(results) {
    if (!Array.isArray(results)) return [];
    
    const uniqueResults = [];
    const seenQueries = new Set();
    
    // Sort by timestamp (most recent first)
    const sortedResults = results.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    for (const result of sortedResults) {
      const normalizedQuery = this.normalizeQuery(result.query);
      
      // Check if we've seen a similar query
      let isDuplicate = false;
      for (const seenQuery of seenQueries) {
        if (this.areQueriesSimilar(normalizedQuery, seenQuery)) {
          isDuplicate = true;
          break;
        }
      }
      
      if (!isDuplicate) {
        uniqueResults.push(result);
        seenQueries.add(normalizedQuery);
      }
    }
    
    return uniqueResults;
  }

  /**
   * Clean up corrupted or invalid storage
   */
  cleanupStorage() {
    try {
      // Validate pinned articles
      const pinnedArticles = this.getPinnedArticles();
      if (!Array.isArray(pinnedArticles)) {
        console.warn('Invalid pinned articles data, resetting');
        this.safeRemove(this.storageKeys.PINNED_ARTICLES);
      }
      
      // Validate stored search results
      const storedResults = this.getStoredSearchResults();
      if (!Array.isArray(storedResults)) {
        console.warn('Invalid stored search results data, resetting');
        this.safeRemove(this.storageKeys.STORED_SEARCH_RESULTS);
      }
      
      // Validate dark mode setting
      const darkMode = this.getDarkMode();
      if (typeof darkMode !== 'boolean') {
        console.warn('Invalid dark mode data, resetting');
        this.safeRemove(this.storageKeys.DARK_MODE);
      }
      
    } catch (error) {
      console.error('Storage cleanup failed:', error);
    }
  }

  /**
   * Handle storage errors gracefully
   */
  handleStorageError(error, key = null, value = null) {
    console.error('Storage error:', error);
    
    if (error.name === 'QuotaExceededError') {
      console.warn('Storage quota exceeded, attempting cleanup');
      this.cleanupOldData();
      
      // Try to save the most important data
      if (key === this.storageKeys.PINNED_ARTICLES && value) {
        try {
          // Try to save a smaller subset
          const limited = value.slice(0, 10); // Keep only 10 most recent
          this.safeSet(key, limited);
        } catch (retryError) {
          console.error('Failed to save limited data:', retryError);
        }
      }
    }
  }

  /**
   * Clear all storage
   */
  clearAllStorage() {
    try {
      Object.values(this.storageKeys).forEach(key => {
        this.safeRemove(key);
      });
      console.log('All storage cleared');
    } catch (error) {
      console.error('Failed to clear all storage:', error);
    }
  }

  // Pinned Articles Methods
  getPinnedArticles() {
    const articles = this.safeGet(this.storageKeys.PINNED_ARTICLES, []);
    return Array.isArray(articles) ? articles : [];
  }

  setPinnedArticles(articles) {
    if (!Array.isArray(articles)) {
      console.error('Pinned articles must be an array');
      return;
    }
    
    // Add timestamp if missing
    const articlesWithTimestamp = articles.map(article => {
      if (!article.pinnedDate) {
        article.pinnedDate = new Date().toISOString();
      }
      return article;
    });
    
    this.safeSet(this.storageKeys.PINNED_ARTICLES, articlesWithTimestamp);
  }

  addPinnedArticle(article) {
    const articles = this.getPinnedArticles();
    
    // Check for duplicates
    if (articles.some(a => a.id === article.id)) {
      console.warn('Article already pinned:', article.id);
      return false;
    }
    
    // Add timestamp
    article.pinnedDate = new Date().toISOString();
    articles.push(article);
    
    this.setPinnedArticles(articles);
    return true;
  }

  removePinnedArticle(articleId) {
    const articles = this.getPinnedArticles();
    const filtered = articles.filter(article => article.id !== articleId);
    this.setPinnedArticles(filtered);
    return articles.length !== filtered.length;
  }

  isArticlePinned(articleId) {
    const articles = this.getPinnedArticles();
    return articles.some(article => article.id === articleId);
  }

  // Stored Search Results Methods
  getStoredSearchResults() {
    const results = this.safeGet(this.storageKeys.STORED_SEARCH_RESULTS, []);
    return Array.isArray(results) ? results : [];
  }

  setStoredSearchResults(results) {
    if (!Array.isArray(results)) {
      console.error('Stored search results must be an array');
      return;
    }
    
    this.safeSet(this.storageKeys.STORED_SEARCH_RESULTS, results);
  }

  addStoredSearchResult(query, articles) {
    const stored = this.getStoredSearchResults();
    
    // Normalize query for comparison
    const normalizedQuery = this.normalizeQuery(query);
    
    // Check for similar queries and remove them
    const filteredStored = stored.filter(result => {
      const resultNormalized = this.normalizeQuery(result.query);
      
      // Remove if queries are too similar (one contains the other)
      if (this.areQueriesSimilar(normalizedQuery, resultNormalized)) {
        console.log(`Removing similar query: "${result.query}" (similar to "${query}")`);
        return false;
      }
      
      return true;
    });
    
    const resultWithMeta = {
      query: query,
      articles: articles,
      timestamp: Date.now()
    };
    
    // Add to beginning and limit size
    filteredStored.unshift(resultWithMeta);
    const trimmed = filteredStored.slice(0, this.maxStoredResults);
    
    this.setStoredSearchResults(trimmed);
  }

  /**
   * Normalize query for comparison (lowercase, trim, remove extra spaces)
   */
  normalizeQuery(query) {
    if (!query || typeof query !== 'string') return '';
    return query.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  /**
   * Check if two queries are similar enough to be considered duplicates
   */
  areQueriesSimilar(query1, query2) {
    if (!query1 || !query2) return false;
    
    // Exact match
    if (query1 === query2) return true;
    
    // One query contains the other (and the shorter one is at least 3 characters)
    const shorter = query1.length < query2.length ? query1 : query2;
    const longer = query1.length < query2.length ? query2 : query1;
    
    if (shorter.length >= 3 && longer.includes(shorter)) {
      return true;
    }
    
    // Check for very similar queries (Levenshtein distance)
    const distance = this.levenshteinDistance(query1, query2);
    const maxLength = Math.max(query1.length, query2.length);
    
    // If distance is small relative to length, consider them similar
    if (maxLength > 0 && distance / maxLength < 0.3) {
      return true;
    }
    
    return false;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  removeStoredSearchResult(index) {
    const stored = this.getStoredSearchResults();
    if (index >= 0 && index < stored.length) {
      stored.splice(index, 1);
      this.setStoredSearchResults(stored);
      return true;
    }
    return false;
  }

  clearStoredSearchResults() {
    this.safeRemove(this.storageKeys.STORED_SEARCH_RESULTS);
  }

  // Dark Mode Methods
  getDarkMode() {
    const darkMode = this.safeGet(this.storageKeys.DARK_MODE, false);
    return typeof darkMode === 'boolean' ? darkMode : false;
  }

  setDarkMode(isDark) {
    if (typeof isDark !== 'boolean') {
      console.error('Dark mode value must be boolean');
      return;
    }
    
    this.safeSet(this.storageKeys.DARK_MODE, isDark);
  }

  // Utility Methods
  getStorageInfo() {
    try {
      let totalSize = 0;
      const items = {};
      
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          const size = localStorage[key].length;
          totalSize += size;
          items[key] = {
            size: size,
            compressed: this.isCompressed(localStorage[key])
          };
        }
      }
      
      return {
        totalSize: totalSize,
        items: items,
        version: this.getStorageVersion(),
        pinnedArticlesCount: this.getPinnedArticles().length,
        storedResultsCount: this.getStoredSearchResults().length
      };
    } catch (error) {
      console.error('Failed to get storage info:', error);
      return null;
    }
  }

  // Export/Import Methods
  exportData() {
    try {
      return {
        version: this.currentVersion,
        exportDate: new Date().toISOString(),
        pinnedArticles: this.getPinnedArticles(),
        storedSearchResults: this.getStoredSearchResults(),
        darkMode: this.getDarkMode()
      };
    } catch (error) {
      console.error('Export failed:', error);
      return null;
    }
  }

  importData(data) {
    try {
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid import data');
      }
      
      if (data.pinnedArticles && Array.isArray(data.pinnedArticles)) {
        this.setPinnedArticles(data.pinnedArticles);
      }
      
      if (data.storedSearchResults && Array.isArray(data.storedSearchResults)) {
        this.setStoredSearchResults(data.storedSearchResults);
      }
      
      if (typeof data.darkMode === 'boolean') {
        this.setDarkMode(data.darkMode);
      }
      
      console.log('Data import completed successfully');
      return true;
    } catch (error) {
      console.error('Import failed:', error);
      return false;
    }
  }
}

// Create global instance
window.storageManager = new StorageManager();
