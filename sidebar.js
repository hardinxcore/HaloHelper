const searchInput = document.getElementById("search");
const resultsDiv = document.getElementById("results");
const pinnedSection = document.getElementById("pinned-section");
const pinnedArticlesDiv = document.getElementById("pinned-articles");
const clearPinnedBtn = document.getElementById("clear-pinned");
const scannedSection = document.getElementById("scanned-section");
const scannedContentDiv = document.getElementById("scanned-content");
const clearScannedBtn = document.getElementById("clear-scanned");
const autoScanIndicator = document.getElementById("auto-scan-indicator");
const autoScanToggle = document.getElementById("auto-scan-toggle");
const crumbsResultsDiv = document.getElementById("crumbs-results");
const darkModeToggle = document.getElementById("dark-mode-toggle");
const darkModeIcon = document.getElementById("dark-mode-icon");
const shortcutsHelp = document.getElementById("shortcuts-help");
const closeShortcutsBtn = document.getElementById("close-shortcuts");
const exportBtn = document.getElementById("export-btn");
const copyAllBtn = document.getElementById("copy-all-btn");
const storageDebug = document.getElementById("storage-debug");
const closeStorageDebugBtn = document.getElementById("close-storage-debug");
const storageInfoContent = document.getElementById("storage-info-content");
const exportStorageDataBtn = document.getElementById("export-storage-data");
const clearAllStorageBtn = document.getElementById("clear-all-storage");
const cleanupDuplicatesBtn = document.getElementById("cleanup-duplicates");
const bulkActions = document.getElementById("bulk-actions");
const bulkCount = document.getElementById("bulk-count");
const bulkPinBtn = document.getElementById("bulk-pin");
const bulkUnpinBtn = document.getElementById("bulk-unpin");
const bulkClearBtn = document.getElementById("bulk-clear");
const ninjaoneSection = document.getElementById("ninjaone-section");
const ninjaoneContent = document.getElementById("ninjaone-content");
const toggleNinjaoneBtn = document.getElementById("toggle-ninjaone");
const clearNinjaoneBtn = document.getElementById("clear-ninjaone");
const favoritesSection = document.getElementById("favorites-section");
const favoritesArticlesDiv = document.getElementById("favorites-articles");
const categoriesSection = document.getElementById("categories-section");
const categoriesListDiv = document.getElementById("categories-list");
const infoBanner = document.getElementById("info-banner");
const closeBannerBtn = document.getElementById("close-banner");

// Storage keys (legacy - now using StorageManager)
const PINNED_ARTICLES_KEY = "haloPinnedArticles";
const STORED_SEARCH_RESULTS_KEY = "haloStoredSearchResults";
const SCANNED_CONTENT_KEY = "haloScannedContent";
const CRUMBS_DATA_KEY = "haloCrumbsData";
const AUTO_SCAN_ENABLED_KEY = "haloAutoScanEnabled";
const DARK_MODE_KEY = "haloDarkMode";
const FAVORITES_KEY = "haloFavorites";
const CATEGORIES_KEY = "haloCategories";
const MAX_STORED_RESULTS = 5; // Limit stored results to prevent localStorage bloat

// Store last search query for reference
let lastSearchQuery = "";

// Bulk selection tracking
let selectedArticles = new Set();

// NinjaOne functionality
const HALO_GUIDE_URL = "https://halo.haloservicedesk.com/api/KBArticle/1222";

// Base API URL
const API_BASE = "https://halo.haloservicedesk.com/api/KBArticle?faqlists=&order=&isportal=true&search=";

async function searchArticles(query) {
  if (!query) {
    // Clear main search results but preserve saved searches
    const mainResults = resultsDiv.querySelectorAll('.result');
    mainResults.forEach(result => result.remove());
    
    // Add placeholder only if no saved searches exist
    const storedSection = resultsDiv.querySelector('.stored-results-section');
    if (!storedSection) {
    resultsDiv.innerHTML = "<p>Type a keyword to search KB articles...</p>";
    } else {
      // Keep saved searches visible
      const placeholder = resultsDiv.querySelector('p');
      if (placeholder) {
        placeholder.remove();
      }
    }
    
    lastSearchQuery = ""; // Reset last search query when input is empty
    return;
  }

  lastSearchQuery = query;
  resultsDiv.innerHTML = "<p>Loading...</p>";

  try {
    const response = await fetch(`${API_BASE}${encodeURIComponent(query)}&paginate=true&page_size=10&page_no=1`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.articles || data.articles.length === 0) {
      resultsDiv.innerHTML = "<p>No articles found.</p>";
      return;
    }

    resultsDiv.innerHTML = "";

    // Save search results to storage
    if (data.articles && data.articles.length > 0) {
      saveStoredSearchResults(data.articles);
    }

    data.articles.forEach(article => {
      const div = document.createElement("div");
      div.className = "result";

      // Check if article is already pinned or favorited
      const isPinned = isArticlePinned(article.id);
      const isFavorited = isArticleFavorited(article.id);

      div.innerHTML = `
        <div class="article-card">
        <div class="article-header">
          <input type="checkbox" class="article-checkbox" data-article-id="${article.id}" title="Select for bulk actions">
          <h4>${article.name}</h4>
        </div>
          <p class="article-description">${article.description || article.tag_string || ""}</p>
          ${generateArticleTags(article)}
        <div class="article-actions">
            <div class="primary-actions">
              <a href="https://usehalo.com/halopsa/guides/${article.id}" target="_blank" class="primary-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15,3 21,3 21,9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
                Open
              </a>
              <button class="primary-btn secondary" data-article-id="${article.id}" title="View Article Content">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                View
              </button>
            </div>
            <div class="secondary-actions">
              <button class="action-menu-btn" data-article='${JSON.stringify(article).replace(/'/g, "&apos;")}' title="More Actions">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="1"></circle>
                  <circle cx="19" cy="12" r="1"></circle>
                  <circle cx="5" cy="12" r="1"></circle>
                </svg>
              </button>
              <div class="action-menu" style="display: none;">
                <button class="action-item" data-action="pin" data-article='${JSON.stringify(article).replace(/'/g, "&apos;")}'>
                  ${isPinned ? 'Unpin' : 'Pin'}
                </button>
                <button class="action-item" data-action="${isFavorited ? 'unfavorite' : 'favorite'}" data-article='${JSON.stringify(article).replace(/'/g, "&apos;")}'>
                  ${isFavorited ? 'Remove from Favorites' : 'Add to Favorites'}
                </button>
                <button class="action-item" data-action="copy" data-url="https://usehalo.com/halopsa/guides/${article.id}">
                  Copy URL
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
      resultsDiv.appendChild(div);
    });
    
    // Display stored search results after main search results
    displayStoredSearchResults();
  } catch (err) {
    console.error('Search error:', err);
    if (err.message.includes('HTTP error')) {
      resultsDiv.innerHTML = `<p>Unable to connect to HaloPSA. Please check your internet connection and try again.</p>`;
    } else {
      resultsDiv.innerHTML = `<p>Error fetching articles: ${err.message}</p>`;
    }
  }
}

// Pinned Articles Functions (using StorageManager)
function getPinnedArticles() {
  return window.storageManager.getPinnedArticles();
}

function savePinnedArticles(articles) {
  window.storageManager.setPinnedArticles(articles);
}

function isArticlePinned(articleId) {
  return window.storageManager.isArticlePinned(articleId);
}

function removeDuplicatePinnedArticles() {
  const pinned = getPinnedArticles();
  const uniqueArticles = [];
  const seenIds = new Set();
  
  pinned.forEach(article => {
    if (!seenIds.has(article.id)) {
      seenIds.add(article.id);
      uniqueArticles.push(article);
    }
  });
  
  if (uniqueArticles.length !== pinned.length) {
    savePinnedArticles(uniqueArticles);
    displayPinnedArticles();
    refreshSearchResults();
    showNotification(`Removed ${pinned.length - uniqueArticles.length} duplicate(s)`);
  }
}

// Stored Search Results Functions (using StorageManager)
function getStoredSearchResults() {
  return window.storageManager.getStoredSearchResults();
}

function saveStoredSearchResults(results) {
  // Don't save if no search query or no results
  if (!lastSearchQuery || !results || results.length === 0) {
    console.log('Not saving search results:', { lastSearchQuery, resultsLength: results?.length });
    return;
  }
  
  console.log('Saving search results for query:', lastSearchQuery, 'with', results.length, 'articles');
  
  const beforeCount = window.storageManager.getStoredSearchResults().length;
  window.storageManager.addStoredSearchResult(lastSearchQuery, results);
  const afterCount = window.storageManager.getStoredSearchResults().length;
  
  // Check if duplicates were removed
  if (beforeCount > afterCount) {
    const removedCount = beforeCount - afterCount;
    showNotification(`Removed ${removedCount} similar search result(s)`);
  }
}

function clearStoredSearchResults() {
  window.storageManager.clearStoredSearchResults();
  displayStoredSearchResults();
}

function removeStoredSearchResult(index) {
  const success = window.storageManager.removeStoredSearchResult(index);
  if (success) {
    displayStoredSearchResults();
  }
}

function toggleStoredResult(index) {
  console.log('Toggling stored result at index:', index);
  const group = document.querySelector(`.stored-result-group[data-index="${index}"]`);
  if (group) {
    const articles = group.querySelector('.stored-articles');
    const toggleBtn = group.querySelector('.toggle-stored-btn');

    if (articles && toggleBtn) {
      const isCollapsed = articles.style.display === 'none' || articles.style.display === '';
      console.log('Toggle state:', { isCollapsed, currentDisplay: articles.style.display });
      
      if (isCollapsed) {
        // Expand
        articles.style.display = 'block';
        toggleBtn.innerHTML = '▼';
        toggleBtn.title = 'Collapse search results';
        console.log('Expanded stored result');
      } else {
        // Collapse
        articles.style.display = 'none';
        toggleBtn.innerHTML = '▶';
        toggleBtn.title = 'Expand search results';
        console.log('Collapsed stored result');
      }
    } else {
      console.log('Could not find articles or toggle button');
    }
    } else {
    console.log('Could not find stored result group at index:', index);
  }
}

// togglePinnedArticles function removed - pinned articles are always displayed when section is shown

function copyToClipboard(text) {
  // Try modern Clipboard API first
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(function() {
      showNotification("URL copied to clipboard!");
    }).catch(function(err) {
      console.error('Failed to copy: ', err);
      fallbackCopyTextToClipboard(text);
    });
  } else {
    // Fallback for older browsers or non-secure contexts
    fallbackCopyTextToClipboard(text);
  }
}

function fallbackCopyTextToClipboard(text) {
  // Create a temporary input element
  const textArea = document.createElement("textarea");
  textArea.value = text;

  // Avoid scrolling to bottom
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const successful = document.execCommand('copy');
    if (successful) {
      showNotification("URL copied to clipboard!");
    } else {
      showNotification("Failed to copy URL", true);
    }
  } catch (err) {
    console.error('Fallback: Oops, unable to copy', err);
    showNotification("Failed to copy URL", true);
  }

  document.body.removeChild(textArea);
}

function displayStoredSearchResults() {
  const stored = getStoredSearchResults();
  console.log('Displaying stored search results:', stored.length, 'stored searches');

  if (stored.length === 0) {
    // Show a message when no stored results exist
    const resultsContainer = document.getElementById('results');
    const existingStored = resultsContainer.querySelector('.stored-results-section');
    if (existingStored) {
      existingStored.remove();
    }
    return;
  }

  // Create stored results section
  let storedHtml = '<div class="stored-results-section">';

  stored.forEach((result, index) => {
    const timeAgo = getTimeAgo(result.timestamp);
    storedHtml += `
      <div class="stored-result-group" data-index="${index}">
        <div class="stored-result-header">
          <div class="stored-header-left">
            <button class="toggle-stored-btn" data-index="${index}" title="Expand search results">▶</button>
            <span class="stored-query">"${result.query}"</span>
          </div>
          <div class="stored-header-right">
            <span class="stored-timestamp">${timeAgo}</span>
            <button class="clear-stored-btn" data-index="${index}" title="Remove this search">×</button>
          </div>
        </div>
        <div class="stored-articles" style="display: none;">
    `;

    result.articles.forEach(article => {
      const isPinned = isArticlePinned(article.id);
      const isFavorited = isArticleFavorited(article.id);

      storedHtml += `
        <div class="result">
          <div class="article-card">
            <div class="article-header">
            <h4>${article.name}</h4>
          </div>
            <p class="article-description">${article.description || article.tag_string || ""}</p>
            ${generateArticleTags(article)}
            <div class="article-actions">
              <div class="primary-actions">
                <a href="https://usehalo.com/halopsa/guides/${article.id}" target="_blank" class="primary-btn">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15,3 21,3 21,9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                  </svg>
                  Open
                </a>
                <button class="primary-btn secondary" data-article-id="${article.id}" title="View Article Content">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                  View
                </button>
              </div>
              <div class="secondary-actions">
                <button class="action-menu-btn" data-article='${JSON.stringify(article).replace(/'/g, "&apos;")}' title="More Actions">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="1"></circle>
                    <circle cx="19" cy="12" r="1"></circle>
                    <circle cx="5" cy="12" r="1"></circle>
                  </svg>
                </button>
                <div class="action-menu" style="display: none;">
                  <button class="action-item" data-action="${isPinned ? 'unpin' : 'pin'}" data-article='${JSON.stringify(article).replace(/'/g, "&apos;")}'>
                    ${isPinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button class="action-item" data-action="${isFavorited ? 'unfavorite' : 'favorite'}" data-article='${JSON.stringify(article).replace(/'/g, "&apos;")}'>
                    ${isFavorited ? 'Remove from Favorites' : 'Add to Favorites'}
                  </button>
                  <button class="action-item" data-action="copy" data-url="https://usehalo.com/halopsa/guides/${article.id}">
                    Copy URL
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    });

    storedHtml += '</div></div>';
  });

  storedHtml += '</div>';

  // Insert stored results after the main results
  const existingStored = document.querySelector('.stored-results-section');
  if (existingStored) {
    existingStored.remove();
  }

  const resultsContainer = document.getElementById('results');
  resultsContainer.insertAdjacentHTML('beforeend', storedHtml);
}

function getTimeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
}

function pinArticle(article) {
  const pinned = getPinnedArticles();
  
  // Double-check to prevent duplicates
  if (!isArticlePinned(article.id)) {
    // Additional check to ensure no duplicates exist
    const alreadyExists = pinned.some(existingArticle => existingArticle.id === article.id);
    if (!alreadyExists) {
      pinned.push(article);
      savePinnedArticles(pinned);
      displayPinnedArticles();
      refreshSearchResults();
      showNotification("Article pinned!");
    }
  }
}

function unpinArticle(articleId) {
  const pinned = getPinnedArticles();
  const filtered = pinned.filter(article => article.id !== articleId);
  savePinnedArticles(filtered);
  displayPinnedArticles();
  refreshSearchResults();
  showNotification("Article unpinned!");
}

function clearAllPinned() {
  if (confirm("Are you sure you want to clear all pinned articles?")) {
    savePinnedArticles([]);
    displayPinnedArticles();
    refreshSearchResults();
    showNotification("All pinned articles cleared!");
  }
}

function displayPinnedArticles() {
  const pinned = getPinnedArticles();

  if (pinned.length === 0) {
    pinnedSection.style.display = "none";
    return;
  }

  pinnedSection.style.display = "block";
  
  // Preserve toggle state when updating content
  const toggleBtn = document.getElementById('toggle-pinned');
  const wasCollapsed = toggleBtn && pinnedArticlesDiv.style.display === 'none';
  
  pinnedArticlesDiv.innerHTML = "";

  pinned.forEach(article => {
    const div = document.createElement("div");
    div.className = "result";

    // Check if article is already favorited
    const isFavorited = isArticleFavorited(article.id);
    const favoriteIcon = isFavorited ? '<img src="icons/favorite.png" alt="Favorite" style="width: 16px; height: 16px;">' : '<img src="icons/favorite.png" alt="Favorite" style="width: 16px; height: 16px; opacity: 0.5;">';

    div.innerHTML = `
      <div class="article-card">
        <div class="article-header">
        <h4>${article.name}</h4>
        </div>
        <p class="article-description">${article.description || article.tag_string || ""}</p>
        <div class="article-actions">
          <div class="primary-actions">
            <a href="https://usehalo.com/halopsa/guides/${article.id}" target="_blank" class="primary-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15,3 21,3 21,9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
              Open
            </a>
            <button class="primary-btn secondary" data-article-id="${article.id}" title="View Article Content">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              View
            </button>
          </div>
          <div class="secondary-actions">
            <button class="action-menu-btn" data-article='${JSON.stringify(article).replace(/'/g, "&apos;")}' title="More Actions">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="1"></circle>
                <circle cx="19" cy="12" r="1"></circle>
                <circle cx="5" cy="12" r="1"></circle>
              </svg>
            </button>
            <div class="action-menu" style="display: none;">
              <button class="action-item" data-action="unpin" data-article='${JSON.stringify(article).replace(/'/g, "&apos;")}'>
                Unpin
              </button>
              <button class="action-item" data-action="favorite" data-article='${JSON.stringify(article).replace(/'/g, "&apos;")}'>
                ${isFavorited ? 'Remove from Favorites' : 'Add to Favorites'}
              </button>
                  <button class="action-item" data-action="copy" data-url="https://usehalo.com/halopsa/guides/${article.id}">
                    Copy URL
                  </button>
            </div>
          </div>
        </div>
      </div>
    `;
    pinnedArticlesDiv.appendChild(div);
  });
  
  // Restore toggle state from localStorage
  if (toggleBtn) {
    const isCollapsed = localStorage.getItem('pinnedArticlesCollapsed') === 'true';
    
    if (isCollapsed) {
      // Set collapsed state
      pinnedArticlesDiv.style.display = 'none';
      toggleBtn.innerHTML = '▶';
      toggleBtn.title = 'Expand pinned articles';
    } else {
      // Set expanded state (default)
      pinnedArticlesDiv.style.display = 'block';
      toggleBtn.innerHTML = '▼';
      toggleBtn.title = 'Collapse pinned articles';
    }
  }
}

function refreshSearchResults() {
  // Update action menu button states in existing results without new API call
  const actionItems = document.querySelectorAll('.action-item[data-action="pin"], .action-item[data-action="unpin"], .action-item[data-action="favorite"], .action-item[data-action="unfavorite"]');
  
  actionItems.forEach(button => {
    const articleData = button.getAttribute('data-article');
    if (articleData) {
      const article = JSON.parse(articleData.replace(/&apos;/g, "'"));
      const isPinned = isArticlePinned(article.id);
      const isFavorited = isArticleFavorited(article.id);
      const action = button.getAttribute('data-action');

      // Update pin/unpin button text
      if (action === 'pin' || action === 'unpin') {
      if (isPinned) {
          button.textContent = 'Unpin';
          button.setAttribute('data-action', 'unpin');
      } else {
          button.textContent = 'Pin';
          button.setAttribute('data-action', 'pin');
        }
      }
      
      // Update favorite/unfavorite button text
      if (action === 'favorite' || action === 'unfavorite') {
        if (isFavorited) {
          button.textContent = 'Remove from Favorites';
          button.setAttribute('data-action', 'unfavorite');
        } else {
          button.textContent = 'Add to Favorites';
          button.setAttribute('data-action', 'favorite');
        }
      }
    }
  });

  // Update tags in search results
  updateSearchResultTags();
  
  // Update tags in stored search results
  updateStoredSearchResultTags();
}

function updateSearchResultTags() {
  // Find all article cards in search results
  const articleCards = document.querySelectorAll('#results .article-card');
  
  articleCards.forEach(card => {
    // Find the article ID from the checkbox or other element
    const checkbox = card.querySelector('.article-checkbox');
    if (checkbox) {
      const articleId = parseInt(checkbox.getAttribute('data-article-id'));
      
      // Find existing tags container
      let tagsContainer = card.querySelector('.article-tags');
      
      // Generate new tags
      const article = { id: articleId }; // Minimal article object for tag generation
      const newTagsHtml = generateArticleTags(article);
      
      if (tagsContainer) {
        // Replace existing tags
        tagsContainer.outerHTML = newTagsHtml;
      } else if (newTagsHtml) {
        // Add tags after description if they don't exist
        const description = card.querySelector('.article-description');
        if (description) {
          description.insertAdjacentHTML('afterend', newTagsHtml);
        }
      }
    }
  });
}

function updateStoredSearchResultTags() {
  // Find all article cards in stored search results
  const storedArticleCards = document.querySelectorAll('.stored-articles .article-card');
  
  storedArticleCards.forEach(card => {
    // Find the article ID from the action menu button
    const actionMenuBtn = card.querySelector('.action-menu-btn');
    if (actionMenuBtn) {
      const articleData = actionMenuBtn.getAttribute('data-article');
      if (articleData) {
        const article = JSON.parse(articleData.replace(/&apos;/g, "'"));
        const articleId = article.id;
        
        // Find existing tags container
        let tagsContainer = card.querySelector('.article-tags');
        
        // Generate new tags
        const newTagsHtml = generateArticleTags(article);
        
        if (tagsContainer) {
          // Replace existing tags
          tagsContainer.outerHTML = newTagsHtml;
        } else if (newTagsHtml) {
          // Add tags after description if they don't exist
          const description = card.querySelector('.article-description');
          if (description) {
            description.insertAdjacentHTML('afterend', newTagsHtml);
          }
        }
      }
    }
  });
}

function showNotification(message) {
  const notification = document.createElement("div");
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #fe5000;
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 1000;
    animation: slideIn 0.3s ease-out;
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = "slideOut 0.3s ease-in";
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

// Dark Mode Functions (using StorageManager)
function getDarkMode() {
  return window.storageManager.getDarkMode();
}

function setDarkMode(isDark) {
  window.storageManager.setDarkMode(isDark);
  document.body.classList.toggle('dark-mode', isDark);
  darkModeIcon.src = isDark ? 'icons/light-mode.png' : 'icons/dark-mode.png';
  darkModeIcon.alt = isDark ? 'Light Mode' : 'Dark Mode';
  darkModeToggle.title = isDark ? 'Switch to Light Mode (Ctrl+D)' : 'Switch to Dark Mode (Ctrl+D)';
}

function toggleDarkMode() {
  const currentMode = getDarkMode();
  setDarkMode(!currentMode);
  showNotification(currentMode ? 'Switched to Light Mode' : 'Switched to Dark Mode');
}

// Keyboard Shortcuts Functions
function showShortcutsHelp() {
  shortcutsHelp.style.display = 'block';
}

function hideShortcutsHelp() {
  shortcutsHelp.style.display = 'none';
}

function toggleShortcutsHelp() {
  if (shortcutsHelp.style.display === 'none' || shortcutsHelp.style.display === '') {
    showShortcutsHelp();
  } else {
    hideShortcutsHelp();
  }
}

// Export Functions

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportToCSV(data, filename) {
  if (!data || data.length === 0) {
    showNotification('No data to export', true);
    return;
  }

  const headers = ['Title', 'Description', 'URL', 'ID'];
  const csvContent = [
    headers.join(','),
    ...data.map(article => [
      `"${(article.name || '').replace(/"/g, '""')}"`,
      `"${(article.description || article.tag_string || '').replace(/"/g, '""')}"`,
      `"https://usehalo.com/halopsa/guides/${article.id}"`,
      `"${article.id}"`
    ].join(','))
  ].join('\n');

  downloadFile(csvContent, filename, 'text/csv');
  showNotification(`Exported ${data.length} articles to CSV`);
}

function exportToJSON(data, filename) {
  if (!data || data.length === 0) {
    showNotification('No data to export', true);
    return;
  }

  const jsonContent = JSON.stringify(data, null, 2);
  downloadFile(jsonContent, filename, 'application/json');
  showNotification(`Exported ${data.length} articles to JSON`);
}

function exportToText(data, filename) {
  if (!data || data.length === 0) {
    showNotification('No data to export', true);
    return;
  }

  const textContent = data.map(article => 
    `${article.name}\n${article.description || article.tag_string || 'No description'}\nURL: https://usehalo.com/halopsa/guides/${article.id}\n${'='.repeat(50)}`
  ).join('\n\n');

  downloadFile(textContent, filename, 'text/plain');
  showNotification(`Exported ${data.length} articles to Text`);
}

function getCurrentSearchResults() {
  const results = [];
  const resultElements = document.querySelectorAll('.result');
  
  resultElements.forEach(element => {
    const title = element.querySelector('h4')?.textContent || '';
    const description = element.querySelector('p')?.textContent || '';
    const actionMenuBtn = element.querySelector('.action-menu-btn');
    
    if (actionMenuBtn) {
      const articleData = actionMenuBtn.getAttribute('data-article');
      if (articleData) {
        const article = JSON.parse(articleData.replace(/&apos;/g, "'"));
        results.push({
          name: title,
          description: description,
          id: article.id
        });
      }
    }
  });
  
  return results;
}

function getAllData() {
  return {
    pinnedArticles: getPinnedArticles(),
    storedSearchResults: getStoredSearchResults(),
    darkMode: getDarkMode(),
    exportDate: new Date().toISOString(),
    version: '1.0'
  };
}

function handleExport() {
  const timestamp = new Date().toISOString().split('T')[0];
  const data = getPinnedArticles();
  const filename = `halo-pinned-articles-${timestamp}.txt`;

  if (!data || data.length === 0) {
    showNotification('No pinned articles to export', true);
    return;
  }

  exportToText(data, filename);
}

function copyAllPinnedArticles() {
  const data = getPinnedArticles();

  if (!data || data.length === 0) {
    showNotification('No pinned articles to copy', true);
    return;
  }

  const textContent = data.map(article => 
    `${article.name}\n${article.description || article.tag_string || 'No description'}\nURL: https://usehalo.com/halopsa/guides/${article.id}\n${'='.repeat(50)}`
  ).join('\n\n');

  copyToClipboard(textContent);
  showNotification(`Copied ${data.length} pinned article(s) to clipboard!`);
}

// Storage Debug Functions
function showStorageDebug() {
  const storageInfo = window.storageManager.getStorageInfo();
  
  if (storageInfo) {
    const infoText = `Storage Version: ${storageInfo.version}
Total Storage Size: ${formatBytes(storageInfo.totalSize)}
Pinned Articles: ${storageInfo.pinnedArticlesCount}
Stored Search Results: ${storageInfo.storedResultsCount}

Storage Items:
${Object.entries(storageInfo.items).map(([key, info]) => 
  `${key}: ${formatBytes(info.size)} ${info.compressed ? '(compressed)' : ''}`
).join('\n')}`;
    
    storageInfoContent.textContent = infoText;
  } else {
    storageInfoContent.textContent = 'Failed to retrieve storage information';
  }
  
  storageDebug.style.display = 'block';
}

function hideStorageDebug() {
  storageDebug.style.display = 'none';
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function exportStorageData() {
  const data = window.storageManager.exportData();
  
  if (data) {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `halo-storage-backup-${timestamp}.json`;
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Storage data exported successfully!');
  } else {
    showNotification('Failed to export storage data', true);
  }
}

function clearAllStorage() {
  if (confirm('Are you sure you want to clear ALL storage data? This action cannot be undone.')) {
    window.storageManager.clearAllStorage();
    displayPinnedArticles();
    displayStoredSearchResults();
    hideStorageDebug();
    showNotification('All storage data cleared!');
  }
}

function cleanupDuplicates() {
  const beforeCount = window.storageManager.getStoredSearchResults().length;
  
  // Trigger cleanup
  window.storageManager.cleanupOldData();
  
  const afterCount = window.storageManager.getStoredSearchResults().length;
  const removedCount = beforeCount - afterCount;
  
  // Refresh display
  displayStoredSearchResults();
  
  if (removedCount > 0) {
    showNotification(`Removed ${removedCount} duplicate search result(s)!`);
  } else {
    showNotification('No duplicates found.');
  }
  
  // Refresh storage info
  showStorageDebug();
}

// Bulk Actions Functions
function updateBulkActions() {
  const selectedCount = selectedArticles.size;
  
  if (selectedCount > 0) {
    bulkActions.style.display = 'block';
    bulkCount.textContent = `${selectedCount} selected`;
    
    // Update button states based on selection
    const hasPinned = Array.from(selectedArticles).some(id => isArticlePinned(id));
    const hasUnpinned = Array.from(selectedArticles).some(id => !isArticlePinned(id));
    
    bulkPinBtn.style.display = hasUnpinned ? 'inline-flex' : 'none';
    bulkUnpinBtn.style.display = hasPinned ? 'inline-flex' : 'none';
  } else {
    bulkActions.style.display = 'none';
  }
}

function toggleArticleSelection(articleId, isChecked) {
  if (isChecked) {
    selectedArticles.add(articleId);
  } else {
    selectedArticles.delete(articleId);
  }
  updateBulkActions();
}

function clearSelection() {
  selectedArticles.clear();
  
  // Uncheck all checkboxes
  const checkboxes = document.querySelectorAll('.article-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.checked = false;
  });
  
  updateBulkActions();
}

function bulkPinArticles() {
  const articlesToPin = Array.from(selectedArticles).filter(id => !isArticlePinned(id));
  
  if (articlesToPin.length === 0) {
    showNotification('No unpinned articles selected');
    return;
  }
  
  // Get article data from current results
  const pinned = getPinnedArticles();
  const checkboxes = document.querySelectorAll('.article-checkbox:checked');
  
  checkboxes.forEach(checkbox => {
    const articleId = checkbox.getAttribute('data-article-id');
    
    // Double-check that article is not already pinned to prevent duplicates
    if (!isArticlePinned(articleId)) {
      // Find article data in current results
      const articleElement = checkbox.closest('.result');
      if (articleElement) {
        const actionMenuBtn = articleElement.querySelector('.action-menu-btn');
        if (actionMenuBtn) {
          const articleData = actionMenuBtn.getAttribute('data-article');
          if (articleData) {
            const article = JSON.parse(articleData.replace(/&apos;/g, "'"));
            
            // Final check to ensure no duplicates
            const alreadyExists = pinned.some(existingArticle => existingArticle.id === article.id);
            if (!alreadyExists) {
              pinned.push(article);
            }
          }
        }
      }
    }
  });
  
  savePinnedArticles(pinned);
  displayPinnedArticles();
  refreshSearchResults();
  clearSelection();
  showNotification(`${articlesToPin.length} article(s) pinned!`);
}

function bulkUnpinArticles() {
  const articlesToUnpin = Array.from(selectedArticles).filter(id => isArticlePinned(id));
  
  if (articlesToUnpin.length === 0) {
    showNotification('No pinned articles selected');
    return;
  }
  
  const pinned = getPinnedArticles();
  const filtered = pinned.filter(article => !selectedArticles.has(article.id));
  
  savePinnedArticles(filtered);
  displayPinnedArticles();
  refreshSearchResults();
  clearSelection();
  showNotification(`${articlesToUnpin.length} article(s) unpinned!`);
}

// Keyboard Event Handler
function handleKeyboardShortcuts(e) {
  // Ctrl+K: Focus search input
  if (e.ctrlKey && e.key === 'k') {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
    return;
  }

  // Ctrl+D: Toggle dark mode
  if (e.ctrlKey && e.key === 'd') {
    e.preventDefault();
    toggleDarkMode();
    return;
  }

  // Ctrl+E: Export pinned articles
  if (e.ctrlKey && e.key === 'e') {
    e.preventDefault();
    handleExport();
    return;
  }

  // Ctrl+Shift+S: Show storage debug
  if (e.ctrlKey && e.shiftKey && e.key === 'S') {
    e.preventDefault();
    showStorageDebug();
    return;
  }

  // Esc: Clear search or close modals
  if (e.key === 'Escape') {
    if (shortcutsHelp.style.display === 'block') {
      hideShortcutsHelp();
    } else if (storageDebug.style.display === 'block') {
      hideStorageDebug();
    } else if (searchInput.value.trim()) {
      searchInput.value = '';
      searchInput.focus();
      searchArticles('');
    }
    return;
  }

  // ?: Show/hide shortcuts help
  if (e.key === '?' && !e.ctrlKey && !e.altKey) {
    e.preventDefault();
    toggleShortcutsHelp();
    return;
  }

  // Enter: Search (when search input is focused)
  if (e.key === 'Enter' && document.activeElement === searchInput) {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (query) {
      searchArticles(query);
    }
  }
}

// Event listener for pin/unpin buttons - removed since we now use action menu

// Main event listener for various interactions
document.addEventListener("click", (e) => {
  // Pinned unpin button removed from pinned articles section
  // Unpin functionality is now only available through search results

  if (e.target.classList.contains("clear-stored-btn")) {
    const index = parseInt(e.target.getAttribute("data-index"));
    removeStoredSearchResult(index);
  }

  if (e.target.classList.contains("toggle-stored-btn")) {
    const index = parseInt(e.target.getAttribute("data-index"));
    toggleStoredResult(index);
  }

  if (e.target.closest(".stored-result-header") && !e.target.classList.contains("clear-stored-btn") && !e.target.classList.contains("toggle-stored-btn")) {
    const header = e.target.closest(".stored-result-header");
    const group = header.closest(".stored-result-group");
    if (group) {
      const index = parseInt(group.getAttribute("data-index"));
      toggleStoredResult(index);
    }
  }

  // toggle-pinned functionality removed - pinned articles are always displayed when section is shown

  if (e.target.classList.contains("copy-url-btn")) {
    const url = e.target.getAttribute("data-url");
    copyToClipboard(url);
  }

  if (e.target.classList.contains("unpin-article-btn")) {
    const articleData = e.target.getAttribute("data-article");
    const article = JSON.parse(articleData.replace(/&apos;/g, "'"));
    unpinArticle(article.id);
  }

  if (e.target.classList.contains("toggle-scanned-btn") || (e.target.closest(".section-header") && e.target.id !== "clear-scanned" && !e.target.closest("#pinned-section") && !e.target.closest(".toggle-pinned-btn"))) {
    toggleScannedContent();
  }

  if (e.target.classList.contains("toggle-pinned-btn")) {
    e.stopPropagation();
    togglePinnedContent();
  }

  if (e.target.classList.contains("clear-scanned-btn")) {
    clearScannedContent();
  }

  // NinjaOne article button click handler
  if (e.target.classList.contains("ninjaone-article-btn") || e.target.closest(".ninjaone-article-btn")) {
    const button = e.target.classList.contains("ninjaone-article-btn") ? e.target : e.target.closest(".ninjaone-article-btn");
    const articleId = button.getAttribute("data-article-id");
    if (articleId) {
      loadArticleContent(articleId);
    }
  }

  // View button click handler
  if (e.target.classList.contains("primary-btn") && e.target.classList.contains("secondary")) {
    const articleId = e.target.getAttribute("data-article-id");
    if (articleId) {
      loadArticleContent(articleId);
    }
  }

  // Favorite button click handler - removed since we now use action menu

  // Unfavorite button click handler
  if (e.target.classList.contains("unfavorite-article-btn")) {
    const articleData = e.target.getAttribute("data-article");
    const article = JSON.parse(articleData.replace(/&apos;/g, "'"));
    removeFromFavorites(article.id);
  }

  // Action menu button click handler
  if (e.target.classList.contains("action-menu-btn") || e.target.closest(".action-menu-btn")) {
    const button = e.target.classList.contains("action-menu-btn") ? e.target : e.target.closest(".action-menu-btn");
    const menu = button.nextElementSibling;
    
    // Close all other menus
    document.querySelectorAll('.action-menu').forEach(m => {
      if (m !== menu) m.style.display = 'none';
    });
    
    // Toggle current menu
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  }

  // Action menu item click handler
  if (e.target.classList.contains("action-item")) {
    const action = e.target.getAttribute("data-action");
    const articleData = e.target.getAttribute("data-article");
    const url = e.target.getAttribute("data-url");
    
    if (articleData) {
      const article = JSON.parse(articleData.replace(/&apos;/g, "'"));
      
      switch (action) {
        case 'pin':
          if (isArticlePinned(article.id)) {
            unpinArticle(article.id);
          } else {
            pinArticle(article);
          }
          break;
        case 'unpin':
          unpinArticle(article.id);
          break;
        case 'favorite':
          if (isArticleFavorited(article.id)) {
            removeFromFavorites(article.id);
          } else {
            addToFavorites(article);
          }
          break;
        case 'unfavorite':
          removeFromFavorites(article.id);
          break;
        case 'category':
          // TODO: Implement category functionality
          showNotification('Category feature coming soon!');
          break;
      }
    }
    
    if (action === 'copy' && url) {
      copyToClipboard(url);
    }
    
    // Close menu
    e.target.closest('.action-menu').style.display = 'none';
  }

  // Close action menus when clicking outside
  if (!e.target.closest('.action-menu') && !e.target.closest('.action-menu-btn')) {
    document.querySelectorAll('.action-menu').forEach(menu => {
      menu.style.display = 'none';
    });
  }

  // Navigation functionality
  if (e.target.closest('.nav-item')) {
    const navItem = e.target.closest('.nav-item');
    const section = navItem.getAttribute('data-section');
    
    // Remove active class from all nav items
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
    
    // Add active class to clicked item
    navItem.classList.add('active');
    
    // Handle section switching
    switch (section) {
      case 'search':
        showSearchSection();
        break;
      case 'favorites':
        showFavoritesSection();
        break;
    }
  }

});

// Event listener for clear all pinned button
if (clearPinnedBtn) {
  clearPinnedBtn.addEventListener("click", clearAllPinned);
}

// Event listener for dark mode toggle
if (darkModeToggle) {
darkModeToggle.addEventListener("click", toggleDarkMode);
}

// Event listener for auto-scan toggle
if (autoScanToggle) {
autoScanToggle.addEventListener("change", toggleAutoScan);
}

// Event listener for close shortcuts help
if (closeShortcutsBtn) {
closeShortcutsBtn.addEventListener("click", hideShortcutsHelp);
}

// Event listener for close banner
if (closeBannerBtn) {
  closeBannerBtn.addEventListener("click", () => {
    if (infoBanner) {
      infoBanner.classList.add("hidden");
    }
  });
}

// Event listeners for export
if (exportBtn) {
exportBtn.addEventListener("click", handleExport);
}

// Event listener for copy all pinned articles
if (copyAllBtn) {
copyAllBtn.addEventListener("click", copyAllPinnedArticles);
}

// Event listeners for storage debug
if (closeStorageDebugBtn) {
closeStorageDebugBtn.addEventListener("click", hideStorageDebug);
}
if (exportStorageDataBtn) {
exportStorageDataBtn.addEventListener("click", exportStorageData);
}
if (clearAllStorageBtn) {
clearAllStorageBtn.addEventListener("click", clearAllStorage);
}
if (cleanupDuplicatesBtn) {
cleanupDuplicatesBtn.addEventListener("click", cleanupDuplicates);
}

// Event listener for keyboard shortcuts
document.addEventListener("keydown", handleKeyboardShortcuts);

// Event listeners for bulk actions
if (bulkPinBtn) {
  bulkPinBtn.addEventListener("click", bulkPinArticles);
}
if (bulkUnpinBtn) {
  bulkUnpinBtn.addEventListener("click", bulkUnpinArticles);
}
if (bulkClearBtn) {
  bulkClearBtn.addEventListener("click", clearSelection);
}

// Event listener for article checkboxes
document.addEventListener("change", (e) => {
  if (e.target.classList.contains("article-checkbox")) {
    const articleId = e.target.getAttribute("data-article-id");
    const isChecked = e.target.checked;
    toggleArticleSelection(articleId, isChecked);
  }
});

// Event listeners for NinjaOne functionality
if (toggleNinjaoneBtn) {
  toggleNinjaoneBtn.addEventListener("click", toggleNinjaoneContent);
}
if (clearNinjaoneBtn) {
  clearNinjaoneBtn.addEventListener("click", clearNinjaoneContent);
}

// Event listener for pinned articles toggle - handled by main click handler

// Event listeners for favorites functionality - clear all removed

// Favorites toggle removed - favorites are always displayed when section is shown

function showSearchSection() {
  // Hide all content sections
  document.querySelectorAll('.content-section').forEach(section => {
    section.style.display = 'none';
  });
  
  // Hide favorites section specifically
  const favoritesSection = document.getElementById('favorites-section');
  if (favoritesSection) {
    favoritesSection.style.display = 'none';
  }
  
  // Show search-related elements
  document.querySelector('.search-wrapper').style.display = 'block';
  document.getElementById('results').style.display = 'block';
  
  // Show auto-scan toggle
  document.querySelector('.scan-wrapper').style.display = 'block';
  
  // Show pinned articles section (only if there are pinned articles)
  displayPinnedArticles();
  
  // Hide ninjaone section initially - only show when View is clicked
  const ninjaoneSection = document.getElementById('ninjaone-section');
  if (ninjaoneSection) {
    ninjaoneSection.style.display = 'none';
  }
  
  // Show bulk actions if needed
  const bulkActions = document.getElementById('bulk-actions');
  if (bulkActions && bulkActions.style.display !== 'none') {
    bulkActions.style.display = 'block';
  }
}


function showFavoritesSection() {
  // Hide all content sections
  document.querySelectorAll('.content-section').forEach(section => {
    section.style.display = 'none';
  });
  
  // Hide pinned section
  const pinnedSection = document.getElementById('pinned-section');
  if (pinnedSection) {
    pinnedSection.style.display = 'none';
  }
  
  // Hide search and auto-scan in favorites tab
  document.querySelector('.search-wrapper').style.display = 'none';
  document.getElementById('results').style.display = 'none';
  document.querySelector('.scan-wrapper').style.display = 'none';
  
  // Hide ninjaone section initially - only show when View is clicked
  const ninjaoneSection = document.getElementById('ninjaone-section');
  if (ninjaoneSection) {
    ninjaoneSection.style.display = 'none';
  }
  
  // Hide bulk actions
  const bulkActions = document.getElementById('bulk-actions');
  if (bulkActions) {
    bulkActions.style.display = 'none';
  }
  
  // Show favorites section
  const favoritesSection = document.getElementById('favorites-section');
  if (favoritesSection) {
    favoritesSection.style.display = 'block';
    displayFavorites(); // Always display favorites when section is shown
  }
}


// Store search timeout for debouncing
let searchTimeout;

// Trigger search on input change with debouncing
searchInput.addEventListener("input", (e) => {
  const query = e.target.value.trim();

  // Clear previous timeout
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }

  // Set new timeout to debounce search
  searchTimeout = setTimeout(() => {
  searchArticles(query);
  }, 300); // 300ms delay
});

// Initialize sidebar
function initializeSidebar() {
  // Initialize dark mode
  const isDarkMode = getDarkMode();
  setDarkMode(isDarkMode);
  
  // Remove any duplicate pinned articles on startup
  removeDuplicatePinnedArticles();
  
  displayPinnedArticles();
  displayFavorites(); // Show favorites on startup
  displayStoredSearchResults(); // Show saved searches on startup
  loadScannedContent(); // Load scanned content from storage
  
  // Load auto-scan setting
  loadAutoScanSetting();

  // Auto-scan current page when sidebar opens
  autoScanCurrentPage();

  // If there's a search term, refresh results to show correct pin states
  const searchValue = searchInput.value.trim();
  if (searchValue) {
    lastSearchQuery = searchValue;
    searchArticles(searchValue);
  } else {
    // If no search term, ensure saved searches are visible
    displayStoredSearchResults();
  }
}


// Auto-scan functionality
async function autoScanCurrentPage() {
  // Check if auto-scan is enabled
  if (!isAutoScanEnabled()) {
    return;
  }

  try {
    // Show auto-scan indicator
    if (autoScanIndicator) {
      autoScanIndicator.style.display = 'flex';
    }

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tabs || tabs.length === 0) {
      hideAutoScanIndicator();
      return;
    }
    
    const tab = tabs[0];
    
    // Skip restricted pages
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      hideAutoScanIndicator();
      return;
    }

    // Execute content script to scan for crumbs
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: extractCrumbsContent
    });

    if (results && results[0] && results[0].result) {
      const crumbsContent = results[0].result;
      displayScannedContent(crumbsContent);
    }
    
    hideAutoScanIndicator();
  } catch (error) {
    console.error('Auto-scan error:', error);
    hideAutoScanIndicator();
    // Silent fail for auto-scan
  }
}

// Hide auto-scan indicator
function hideAutoScanIndicator() {
  if (autoScanIndicator) {
    autoScanIndicator.style.display = 'none';
  }
}

// Check if auto-scan is enabled
function isAutoScanEnabled() {
  const saved = localStorage.getItem(AUTO_SCAN_ENABLED_KEY);
  return saved === null ? false : saved === 'true'; // Default to disabled
}

// Set auto-scan enabled state
function setAutoScanEnabled(enabled) {
  localStorage.setItem(AUTO_SCAN_ENABLED_KEY, enabled.toString());
}

// Load auto-scan setting
function loadAutoScanSetting() {
  const enabled = isAutoScanEnabled();
  if (autoScanToggle) {
    autoScanToggle.checked = enabled;
  }
}

// Toggle auto-scan setting
function toggleAutoScan() {
  const enabled = autoScanToggle.checked;
  setAutoScanEnabled(enabled);
  
  // If disabling, clear current scanned content
  if (!enabled) {
    clearScannedContent();
  } else {
    // If enabling, immediately scan the current page
    autoScanCurrentPage();
  }
}

// Function to extract crumbs content (executed in page context)
function extractCrumbsContent() {
  // Function to clean crumbs content by extracting the last element
  function cleanCrumbsContent(content) {
    // Split by ">" and get the last element
    const parts = content.split('>');
    
    if (parts.length > 1) {
      // Get the last part and trim whitespace
      const lastElement = parts[parts.length - 1].trim();
      
      // If last element is not empty, return it
      if (lastElement) {
        return lastElement;
      }
    }
    
    // If no ">" found or last element is empty, return original content
    return content.trim();
  }

  const crumbsElements = document.querySelectorAll('.crumbs');
  const crumbsData = [];

  crumbsElements.forEach((element, index) => {
    // Extract text content without HTML tags
    let textContent = element.textContent || element.innerText || '';
    
    if (textContent.trim()) {
      // Clean up crumbs content to get only the last element
      const cleanedContent = cleanCrumbsContent(textContent.trim());
      
      console.log('Original crumb:', textContent.trim());
      console.log('Cleaned crumb:', cleanedContent);
      
      crumbsData.push({
        id: `crumb-${Date.now()}-${index}`,
        content: cleanedContent,
        url: window.location.href,
        title: document.title || 'Untitled',
        timestamp: Date.now()
      });
    }
  });

  return crumbsData;
}

// Display scanned content
function displayScannedContent(crumbsData) {
  if (!crumbsData || crumbsData.length === 0) {
    scannedContentDiv.textContent = '';
    crumbsResultsDiv.innerHTML = '';
    scannedSection.style.display = 'none';
    return;
  }

  // Store crumbs data
  localStorage.setItem(CRUMBS_DATA_KEY, JSON.stringify(crumbsData));

  // Show content display area
  scannedContentDiv.style.display = 'block';

  // Hide crumb cards
  crumbsResultsDiv.style.display = 'none';

  // Auto-search guides with the first crumb's content
  if (crumbsData.length > 0) {
    searchGuidesWithCrumbs(crumbsData[0].content);
  }

  scannedSection.style.display = 'block';
}


// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Display auto-search results in suggested content section
function displayAutoSearchResultsInSuggested(articles, originalContent) {
  scannedContentDiv.innerHTML = '';
  
  articles.forEach(article => {
    const div = document.createElement("div");
    div.className = "result";
    
    // Check if article is already pinned
    const isPinned = isArticlePinned(article.id);
    
    div.innerHTML = `
      <div class="article-header">
        <input type="checkbox" class="article-checkbox" data-article-id="${article.id}" title="Select for bulk actions">
        <h4>${article.name}</h4>
      </div>
      <p>${article.description || article.tag_string || ""}</p>
      <div class="article-actions">
        <a href="https://usehalo.com/halopsa/guides/${article.id}" target="_blank">Open Article</a>
        <button class="ninjaone-article-btn" data-article-id="${article.id}" title="Load Guide Content">
          <img src="icons/ninjaone.png" alt="NinjaOne" class="ninjaone-icon"> Load Content
        </button>
        ${pinButtonHtml}
      </div>
    `;
    scannedContentDiv.appendChild(div);
  });
  
  // Add reference to original content
  const referenceDiv = document.createElement("div");
  referenceDiv.className = "auto-search-reference";
  referenceDiv.innerHTML = `
    <div style="margin-top: 12px; padding: 8px; background: #f0f8ff; border-radius: 4px; font-size: 12px; color: #666;">
      <strong>Auto-search based on:</strong> ${escapeHtml(originalContent.substring(0, 100))}${originalContent.length > 100 ? '...' : ''}
    </div>
  `;
  scannedContentDiv.appendChild(referenceDiv);
}


// Search guides using crumbs content
async function searchGuidesWithCrumbs(crumbsContent) {
  try {
    // Use the full crumbs content as search query
    const searchQuery = crumbsContent.trim();
    
    // Search HaloPSA guides with the full crumbs content
    const response = await fetch(`${API_BASE}${encodeURIComponent(searchQuery)}&paginate=true&page_size=10&page_no=1`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.articles || data.articles.length === 0) {
      scannedContentDiv.innerHTML = '<p>No related guides found.</p>';
      return;
    }
    
    // Display guide results in suggested content section
    displayAutoSearchResultsInSuggested(data.articles, crumbsContent);
    
  } catch (error) {
    console.error('Guide search error:', error);
    scannedContentDiv.innerHTML = '<p>Error searching guides. Please try again.</p>';
  }
}




// Load scanned content from storage
function loadScannedContent() {
  const savedData = localStorage.getItem(CRUMBS_DATA_KEY);
  if (savedData) {
    const crumbsData = JSON.parse(savedData);
    displayScannedContent(crumbsData);
  } else {
    // Fallback to old format
    const savedContent = localStorage.getItem(SCANNED_CONTENT_KEY);
    if (savedContent) {
      displayScannedContent(savedContent);
    }
  }
}

// Clear scanned content
function clearScannedContent() {
  scannedContentDiv.textContent = '';
  crumbsResultsDiv.innerHTML = '';
  scannedSection.style.display = 'none';
  localStorage.removeItem(SCANNED_CONTENT_KEY);
  localStorage.removeItem(CRUMBS_DATA_KEY);
  showNotification("Scanned content cleared!");
}

// Toggle scanned content visibility
function toggleScannedContent() {
  const scannedContent = document.getElementById('scanned-content');
  const toggleBtn = document.getElementById('toggle-scanned');

  if (scannedContent && toggleBtn) {
    const isCollapsed = scannedContent.style.display === 'none';
    if (isCollapsed) {
      // Expand
      scannedContent.style.display = 'block';
      toggleBtn.innerHTML = '▼';
      toggleBtn.title = 'Collapse scanned content';
    } else {
      // Collapse
      scannedContent.style.display = 'none';
      toggleBtn.innerHTML = '▶';
      toggleBtn.title = 'Expand scanned content';
    }
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'tabUpdated' || message.action === 'tabActivated') {
    // Auto-scan when tab changes
    setTimeout(() => {
      autoScanCurrentPage();
    }, 500); // Small delay to ensure page is fully loaded
    
    // Send response to acknowledge message received
    sendResponse({ success: true });
  }
  
  // Return true to indicate we will send a response asynchronously
  return true;
});

// NinjaOne Functions
async function loadHaloGuideContent() {
  try {
    // Show loading state
    ninjaoneBtn.disabled = true;
    ninjaoneBtn.innerHTML = '<img src="icons/ninjaone.png" alt="NinjaOne" class="ninjaone-icon"> Loading...';
    
    // Fetch the JSON API content
    const response = await fetch(HALO_GUIDE_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract resolution_html from the JSON response
    let content = '';
    
    if (data.resolution_html) {
      content = data.resolution_html;
    } else if (data.description) {
      // Fallback to description if resolution_html is not available
      content = `<div class="kb-content">
        <h2>${data.name || 'KB Article'}</h2>
        <div class="description">${data.description}</div>
      </div>`;
    } else {
      throw new Error('No content found in the API response');
    }
    
    // Display the content
    displayNinjaoneContent(content);
    
    // Show the section
    ninjaoneSection.style.display = 'block';
    
    showNotification('HaloPSA KB content loaded successfully!');
    
  } catch (error) {
    console.error('Error loading guide content:', error);
    ninjaoneContent.innerHTML = `
      <div style="color: #dc3545; padding: 12px; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px;">
        <strong>Error loading content:</strong> ${error.message}
        <br><br>
        <small>This might be due to CORS restrictions or API changes. Try opening the guide in a new tab instead.</small>
        <br><br>
        <button onclick="openGuideInNewTab()" style="background: #2BD3C6; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 12px;">
          Open Guide in New Tab
        </button>
      </div>
    `;
    ninjaoneSection.style.display = 'block';
    showNotification('Failed to load guide content', true);
  } finally {
    // Reset button state
    ninjaoneBtn.disabled = false;
    ninjaoneBtn.innerHTML = '<img src="icons/ninjaone.png" alt="NinjaOne" class="ninjaone-icon"> Load Guide Content';
  }
}

function cleanHtmlContent(element) {
  // Create a copy to avoid modifying the original
  const clone = element.cloneNode(true);
  
  // Remove unwanted elements
  const unwantedSelectors = [
    'script', 'style', 'nav', 'header', 'footer', '.advertisement', 
    '.ads', '.social-share', '.comments', '.related-posts',
    '.breadcrumb', '.navigation', '.menu', '.sidebar'
  ];
  
  unwantedSelectors.forEach(selector => {
    const elements = clone.querySelectorAll(selector);
    elements.forEach(el => el.remove());
  });
  
  // Clean up attributes
  const allElements = clone.querySelectorAll('*');
  allElements.forEach(el => {
    // Remove most attributes except essential ones
    const allowedAttrs = ['href', 'src', 'alt', 'title'];
    Array.from(el.attributes).forEach(attr => {
      if (!allowedAttrs.includes(attr.name)) {
        el.removeAttribute(attr.name);
      }
    });
  });
  
  return clone.innerHTML;
}

function displayNinjaoneContent(content) {
  ninjaoneContent.innerHTML = content;
}

function clearNinjaoneContent() {
  ninjaoneContent.innerHTML = '';
  ninjaoneSection.style.display = 'none';
  showNotification('Guide content cleared!');
}

function openGuideInNewTab() {
  // Open the web version of the KB article instead of the API endpoint
  window.open('https://support.haloservicedesk.com/kb?btn=46?rss&faqlist=182&id=1367', '_blank');
  showNotification('Opening KB article in new tab...');
}

// Make function globally available for onclick handler
window.openGuideInNewTab = openGuideInNewTab;

function toggleNinjaoneContent() {
  const ninjaoneContent = document.getElementById('ninjaone-content');
  const toggleBtn = document.getElementById('toggle-ninjaone');

  if (ninjaoneContent && toggleBtn) {
    const isCollapsed = ninjaoneContent.style.display === 'none';
    if (isCollapsed) {
      // Expand
      ninjaoneContent.style.display = 'block';
      toggleBtn.innerHTML = '▼';
      toggleBtn.title = 'Collapse guide content';
    } else {
      // Collapse
      ninjaoneContent.style.display = 'none';
      toggleBtn.innerHTML = '▶';
      toggleBtn.title = 'Expand guide content';
    }
  }
}

function togglePinnedContent() {
  const pinnedArticles = document.getElementById('pinned-articles');
  const toggleBtn = document.getElementById('toggle-pinned');

  if (pinnedArticles && toggleBtn) {
    const isCollapsed = pinnedArticles.style.display === 'none';
    
    if (isCollapsed) {
      // Expand
      pinnedArticles.style.display = 'block';
      toggleBtn.innerHTML = '▼';
      toggleBtn.title = 'Collapse pinned articles';
      localStorage.setItem('pinnedArticlesCollapsed', 'false');
    } else {
      // Collapse
      pinnedArticles.style.display = 'none';
      toggleBtn.innerHTML = '▶';
      toggleBtn.title = 'Expand pinned articles';
      localStorage.setItem('pinnedArticlesCollapsed', 'true');
    }
  }
}

// Load guide content for a specific article ID
async function loadArticleContent(articleId) {
  try {
    // Show loading state
    const button = document.querySelector(`[data-article-id="${articleId}"]`);
    if (button) {
      button.disabled = true;
      button.innerHTML = 'Loading...';
    }
    
    // Fetch the JSON API content for the specific article
    const response = await fetch(`https://halo.haloservicedesk.com/api/KBArticle/${articleId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract resolution_html from the JSON response
    let content = '';
    
    if (data.resolution_html) {
      content = data.resolution_html;
    } else if (data.description) {
      // Fallback to description if resolution_html is not available
      content = `<div class="kb-content">
        <h2>${data.name || 'KB Article'}</h2>
        <div class="description">${data.description}</div>
      </div>`;
    } else {
      throw new Error('No content found in the API response');
    }
    
    // Display the content
    displayNinjaoneContent(content);
    
    // Show the section
    ninjaoneSection.style.display = 'block';
    
    showNotification(`KB Article ${articleId} content loaded successfully!`);
    
  } catch (error) {
    console.error('Error loading article content:', error);
    ninjaoneContent.innerHTML = `
      <div style="color: #dc3545; padding: 12px; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px;">
        <strong>Error loading article content:</strong> ${error.message}
        <br><br>
        <small>This might be due to CORS restrictions or API changes. Try opening the article in a new tab instead.</small>
        <br><br>
        <button onclick="openArticleInNewTab(${articleId})" style="background: #2BD3C6; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 12px;">
          Open Article in New Tab
        </button>
      </div>
    `;
    ninjaoneSection.style.display = 'block';
    showNotification('Failed to load article content', true);
  } finally {
    // Reset button state
    const button = document.querySelector(`[data-article-id="${articleId}"]`);
    if (button) {
      button.disabled = false;
      button.innerHTML = '<img src="icons/view-32.png" alt="View" class="view-icon"> View';
    }
  }
}

function openArticleInNewTab(articleId) {
  window.open(`https://usehalo.com/halopsa/guides/${articleId}`, '_blank');
  showNotification('Opening article in new tab...');
}

// Make function globally available for onclick handler
window.openArticleInNewTab = openArticleInNewTab;

// Favorites Functions
function getFavorites() {
  const favorites = localStorage.getItem(FAVORITES_KEY);
  return favorites ? JSON.parse(favorites) : [];
}

function saveFavorites(favorites) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

function isArticleFavorited(articleId) {
  const favorites = getFavorites();
  return favorites.some(fav => fav.id === articleId);
}

function addToFavorites(article) {
  const favorites = getFavorites();
  if (!isArticleFavorited(article.id)) {
    favorites.push({
      ...article,
      favoritedAt: Date.now()
    });
    saveFavorites(favorites);
    displayFavorites();
    refreshSearchResults();
    showNotification("Article added to favorites!");
  }
}

function removeFromFavorites(articleId) {
  const favorites = getFavorites();
  const filtered = favorites.filter(fav => fav.id !== articleId);
  saveFavorites(filtered);
  displayFavorites();
  refreshSearchResults();
  showNotification("Article removed from favorites!");
}


function displayFavorites() {
  const favorites = getFavorites();

  if (favorites.length === 0) {
    favoritesArticlesDiv.innerHTML = '<div class="no-results">No favorite articles yet. Add some articles to your favorites to see them here.</div>';
    return;
  }

  favoritesArticlesDiv.innerHTML = "";

  favorites.forEach(article => {
    const div = document.createElement("div");
    div.className = "result";

    // Check if article is already pinned
    const isPinned = isArticlePinned(article.id);

    div.innerHTML = `
      <div class="article-card">
        <div class="article-header">
          <h4>${article.name}</h4>
        </div>
        <p class="article-description">${article.description || article.tag_string || ""}</p>
        <div class="article-actions">
          <div class="primary-actions">
            <a href="https://usehalo.com/halopsa/guides/${article.id}" target="_blank" class="primary-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15,3 21,3 21,9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
              Open
            </a>
            <button class="primary-btn secondary" data-article-id="${article.id}" title="View Article Content">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              View
            </button>
          </div>
          <div class="secondary-actions">
            <button class="action-menu-btn" data-article='${JSON.stringify(article).replace(/'/g, "&apos;")}' title="More Actions">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="1"></circle>
                <circle cx="19" cy="12" r="1"></circle>
                <circle cx="5" cy="12" r="1"></circle>
              </svg>
            </button>
            <div class="action-menu" style="display: none;">
              <button class="action-item" data-action="${isPinned ? 'unpin' : 'pin'}" data-article='${JSON.stringify(article).replace(/'/g, "&apos;")}'>
                ${isPinned ? 'Unpin' : 'Pin'}
              </button>
              <button class="action-item" data-action="unfavorite" data-article='${JSON.stringify(article).replace(/'/g, "&apos;")}'>
                Remove from Favorites
              </button>
                  <button class="action-item" data-action="copy" data-url="https://usehalo.com/halopsa/guides/${article.id}">
                    Copy URL
                  </button>
            </div>
          </div>
        </div>
      </div>
    `;
    favoritesArticlesDiv.appendChild(div);
  });
}

// Tag generation helper function
function generateArticleTags(article) {
  const isPinned = isArticlePinned(article.id);
  const isFavorited = isArticleFavorited(article.id);
  
  if (!isPinned && !isFavorited) {
    return '';
  }
  
  let tagsHtml = '<div class="article-tags">';
  
  if (isPinned && isFavorited) {
    tagsHtml += `
      <span class="article-tag both">
        <svg class="article-tag-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
        Pinned & Favorite
      </span>
    `;
  } else if (isPinned) {
    tagsHtml += `
      <span class="article-tag pinned">
        <svg class="article-tag-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
        Pinned
      </span>
    `;
  } else if (isFavorited) {
    tagsHtml += `
      <span class="article-tag favorited">
        <svg class="article-tag-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
        Favorite
      </span>
    `;
  }
  
  tagsHtml += '</div>';
  return tagsHtml;
}

// Compact tag generation for smaller spaces
function generateCompactArticleTags(article) {
  const isPinned = isArticlePinned(article.id);
  const isFavorited = isArticleFavorited(article.id);
  
  if (!isPinned && !isFavorited) {
    return '';
  }
  
  let tagsHtml = '<div class="article-tags">';
  
  if (isPinned && isFavorited) {
    tagsHtml += `
      <span class="article-tag both compact">
        <svg class="article-tag-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
        Pinned & Favorite
      </span>
    `;
  } else if (isPinned) {
    tagsHtml += `
      <span class="article-tag pinned compact">
        <svg class="article-tag-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
        Pin
      </span>
    `;
  } else if (isFavorited) {
    tagsHtml += `
      <span class="article-tag favorited compact">
        <svg class="article-tag-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
        Fav
      </span>
    `;
  }
  
  tagsHtml += '</div>';
  return tagsHtml;
}

// toggleFavorites function removed - favorites are always displayed when section is shown

// Initialize when sidebar loads
document.addEventListener("DOMContentLoaded", initializeSidebar);
