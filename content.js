// X Tweet Cleaner - Content Script
// This script runs on twitter.com and x.com pages

(function() {
  'use strict';

  // State
  let isRunning = false;
  let isPaused = false;
  let config = {
    filter: 'all',
    dateFrom: null,
    dateTo: null,
    keyword: '',
    delay: 5000
  };

  // Selectors (X/Twitter DOM structure - may need updates if X changes their UI)
  const SELECTORS = {
    // Tweet containers
    tweet: 'article[data-testid="tweet"]',
    tweetText: '[data-testid="tweetText"]',
    
    // User info
    userHandle: 'a[href*="/"] > div > span',
    
    // Tweet metadata
    timestamp: 'time',
    
    // Reply indicator (tweets that start with "Replying to")
    replyIndicator: '[data-testid="Tweet-User-Avatar"]',
    replyingTo: 'div[dir="ltr"] > span',
    
    // Action buttons
    moreButton: '[data-testid="caret"]',
    deleteButton: '[data-testid="Dropdown"] [role="menuitem"]',
    confirmDeleteButton: '[data-testid="confirmationSheetConfirm"]',
    
    // Modal/Dialog
    modal: '[role="dialog"]',
    
    // Timeline
    timeline: 'section[role="region"]'
  };

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'start':
        config = message.config;
        startCleaning();
        break;
      case 'pause':
        isPaused = true;
        break;
      case 'resume':
        isPaused = false;
        break;
      case 'stop':
        stopCleaning();
        break;
    }
  });

  // Start the cleaning process
  async function startCleaning() {
    isRunning = true;
    isPaused = false;
    
    console.log('[X Tweet Cleaner] Starting with config:', config);
    
    // Get the logged-in username
    const username = await getLoggedInUsername();
    if (!username) {
      sendMessage({ type: 'error', error: 'No se pudo detectar tu nombre de usuario' });
      return;
    }
    
    console.log('[X Tweet Cleaner] Logged in as:', username);
    
    // Navigate to the correct profile section if needed
    await navigateToProfile(username);
    
    // Wait for page to load
    await sleep(2000);
    
    // Start processing tweets
    await processNextTweet(username);
  }

  // Stop cleaning
  function stopCleaning() {
    isRunning = false;
    isPaused = false;
    console.log('[X Tweet Cleaner] Stopped');
  }

  // Get the logged-in username
  async function getLoggedInUsername() {
    // Try to get username from various places
    
    // Method 1: From the navigation sidebar
    const profileLink = document.querySelector('a[data-testid="AppTabBar_Profile_Link"]');
    if (profileLink) {
      const href = profileLink.getAttribute('href');
      if (href) {
        return href.replace('/', '');
      }
    }
    
    // Method 2: From the account switcher
    const accountSwitcher = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
    if (accountSwitcher) {
      const usernameSpan = accountSwitcher.querySelector('span');
      if (usernameSpan && usernameSpan.textContent.startsWith('@')) {
        return usernameSpan.textContent.replace('@', '');
      }
    }
    
    // Method 3: From URL if on profile page
    const urlMatch = window.location.pathname.match(/^\/([^\/]+)(?:\/|$)/);
    if (urlMatch && !['home', 'explore', 'notifications', 'messages', 'search', 'settings', 'i'].includes(urlMatch[1])) {
      return urlMatch[1];
    }
    
    return null;
  }

  // Navigate to profile page
  async function navigateToProfile(username) {
    const currentUrl = window.location.href;
    let targetUrl = `https://x.com/${username}`;
    
    // Adjust URL based on filter
    if (config.filter === 'replies') {
      targetUrl = `https://x.com/${username}/with_replies`;
    }
    
    if (!currentUrl.includes(targetUrl.replace('https://x.com', ''))) {
      window.location.href = targetUrl;
      // Wait for navigation
      await sleep(3000);
    }
  }

  // Process the next tweet
  async function processNextTweet(username) {
    if (!isRunning) return;
    
    while (isPaused) {
      await sleep(500);
      if (!isRunning) return;
    }
    
    // Find all tweets
    const tweets = document.querySelectorAll(SELECTORS.tweet);
    
    if (tweets.length === 0) {
      // Scroll to load more
      window.scrollBy(0, 500);
      await sleep(2000);
      
      const newTweets = document.querySelectorAll(SELECTORS.tweet);
      if (newTweets.length === 0) {
        sendMessage({ type: 'noMoreTweets' });
        sendMessage({ type: 'complete' });
        stopCleaning();
        return;
      }
    }
    
    // Find the first tweet that matches our criteria and belongs to us
    for (const tweet of tweets) {
      if (!isRunning) return;
      
      const result = await processTweet(tweet, username);
      
      if (result === 'deleted') {
        // Wait for the configured delay
        await sleep(config.delay + randomDelay());
        // Continue with next tweet
        await processNextTweet(username);
        return;
      } else if (result === 'skipped') {
        // Mark this tweet as processed and continue
        tweet.dataset.processed = 'true';
      }
    }
    
    // Scroll down to load more tweets
    window.scrollBy(0, 800);
    await sleep(1500);
    
    // Continue processing
    await processNextTweet(username);
  }

  // Process a single tweet
  async function processTweet(tweetElement, username) {
    // Skip if already processed
    if (tweetElement.dataset.processed === 'true') {
      return 'skipped';
    }
    
    // Check if this is our tweet
    const isOwnTweet = await checkIfOwnTweet(tweetElement, username);
    if (!isOwnTweet) {
      return 'skipped';
    }
    
    // Get tweet info
    const tweetInfo = extractTweetInfo(tweetElement);
    
    // Check if tweet matches filters
    if (!matchesFilters(tweetInfo)) {
      sendMessage({ 
        type: 'skipped', 
        reason: 'No coincide con los filtros'
      });
      return 'skipped';
    }
    
    // Try to delete the tweet
    const deleted = await deleteTweet(tweetElement);
    
    if (deleted) {
      sendMessage({ 
        type: 'deleted', 
        text: tweetInfo.text 
      });
      return 'deleted';
    } else {
      sendMessage({ 
        type: 'error', 
        error: 'No se pudo eliminar el tweet'
      });
      return 'skipped';
    }
  }

  // Check if a tweet belongs to the logged-in user
  async function checkIfOwnTweet(tweetElement, username) {
    // Look for the username in the tweet
    const links = tweetElement.querySelectorAll('a[role="link"]');
    
    for (const link of links) {
      const href = link.getAttribute('href');
      if (href === `/${username}`) {
        return true;
      }
    }
    
    return false;
  }

  // Check if we're on the replies tab
  function isOnRepliesTab() {
    const url = window.location.href;
    return url.includes('/with_replies');
  }

  // Extract tweet information
  function extractTweetInfo(tweetElement) {
    const info = {
      text: '',
      isReply: false,
      timestamp: null,
      date: null
    };
    
    // Get tweet text
    const textElement = tweetElement.querySelector(SELECTORS.tweetText);
    if (textElement) {
      info.text = textElement.textContent || '';
    }
    
    // Check if it's a reply - multiple detection methods
    
    // Method 1: Look for "Replying to" / "En respuesta a" text
    const replyIndicators = tweetElement.querySelectorAll('div[dir="ltr"]');
    for (const indicator of replyIndicators) {
      const text = indicator.textContent || '';
      if (text.includes('Replying to') || text.includes('En respuesta a')) {
        info.isReply = true;
        break;
      }
    }
    
    // Method 2: Check full tweet text for reply indicators
    if (!info.isReply) {
      const fullText = tweetElement.textContent || '';
      if (fullText.includes('Replying to @') || fullText.includes('En respuesta a @')) {
        info.isReply = true;
      }
    }
    
    // Method 3: Look for the reply context link (the @username being replied to)
    if (!info.isReply) {
      // X often shows a small link to the person being replied to
      const socialContext = tweetElement.querySelector('[data-testid="socialContext"]');
      if (socialContext && socialContext.textContent) {
        const contextText = socialContext.textContent.toLowerCase();
        if (contextText.includes('replied') || contextText.includes('respondió')) {
          info.isReply = true;
        }
      }
    }
    
    // Method 4: If we're on the /with_replies tab and it's not clearly a standalone tweet,
    // we can be more lenient - check if there's a reply thread indicator
    if (!info.isReply) {
      // Look for the vertical reply line that connects replies
      const replyLine = tweetElement.querySelector('[data-testid="Tweet-User-Avatar"] + div > div[style*="border"]');
      if (replyLine) {
        info.isReply = true;
      }
    }
    
    // Method 5: Check for reply icon in the tweet actions being highlighted
    if (!info.isReply) {
      const replyButton = tweetElement.querySelector('[data-testid="reply"]');
      if (replyButton) {
        // Check if this tweet has a "show thread" or conversation indicator
        const threadIndicator = tweetElement.closest('[data-testid="cellInnerDiv"]');
        if (threadIndicator) {
          const prevSibling = threadIndicator.previousElementSibling;
          if (prevSibling && prevSibling.querySelector('article')) {
            // This tweet follows another tweet - likely part of a thread/reply
            info.isReply = true;
          }
        }
      }
    }
    
    // Get timestamp
    const timeElement = tweetElement.querySelector(SELECTORS.timestamp);
    if (timeElement) {
      const datetime = timeElement.getAttribute('datetime');
      if (datetime) {
        info.timestamp = datetime;
        info.date = new Date(datetime);
      }
    }
    
    return info;
  }

  // Check if tweet matches configured filters
  function matchesFilters(tweetInfo) {
    // Filter by type
    if (config.filter === 'tweets' && tweetInfo.isReply) {
      return false;
    }
    
    // For replies filter: if we're on the /with_replies tab, 
    // trust the tab and don't require isReply detection to be perfect
    if (config.filter === 'replies') {
      if (isOnRepliesTab()) {
        // On replies tab, we're more permissive - X shows replies here
        // Only skip if we're absolutely sure it's NOT a reply (e.g., pinned tweet)
        // For now, accept all tweets on this tab
        console.log('[X Tweet Cleaner] On replies tab, accepting tweet');
      } else if (!tweetInfo.isReply) {
        // Not on replies tab and didn't detect as reply - skip
        return false;
      }
    }
    
    // Filter by date range
    if (config.dateFrom && tweetInfo.date) {
      const fromDate = new Date(config.dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      if (tweetInfo.date < fromDate) {
        return false;
      }
    }
    
    if (config.dateTo && tweetInfo.date) {
      const toDate = new Date(config.dateTo);
      toDate.setHours(23, 59, 59, 999);
      if (tweetInfo.date > toDate) {
        return false;
      }
    }
    
    // Filter by keyword
    if (config.keyword && config.keyword.trim() !== '') {
      const keyword = config.keyword.toLowerCase().trim();
      const text = tweetInfo.text.toLowerCase();
      if (!text.includes(keyword)) {
        return false;
      }
    }
    
    return true;
  }

  // Delete a tweet
  async function deleteTweet(tweetElement) {
    try {
      // Step 1: Click the "more" button (three dots)
      const moreButton = tweetElement.querySelector(SELECTORS.moreButton);
      if (!moreButton) {
        console.log('[X Tweet Cleaner] More button not found');
        return false;
      }
      
      moreButton.click();
      await sleep(500);
      
      // Step 2: Find and click the delete option in the dropdown
      // Wait for dropdown to appear
      await waitForElement('[role="menu"]', 2000);
      
      const menuItems = document.querySelectorAll('[role="menuitem"]');
      let deleteButton = null;
      
      for (const item of menuItems) {
        const text = item.textContent || '';
        if (text.includes('Delete') || text.includes('Eliminar') || text.includes('Borrar')) {
          deleteButton = item;
          break;
        }
      }
      
      if (!deleteButton) {
        // Close the menu by clicking elsewhere
        document.body.click();
        console.log('[X Tweet Cleaner] Delete button not found in menu');
        return false;
      }
      
      deleteButton.click();
      await sleep(500);
      
      // Step 3: Confirm deletion in the modal
      await waitForElement('[data-testid="confirmationSheetConfirm"]', 2000);
      
      const confirmButton = document.querySelector('[data-testid="confirmationSheetConfirm"]');
      if (!confirmButton) {
        // Try alternative selector
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          const text = btn.textContent || '';
          if (text.includes('Delete') || text.includes('Eliminar')) {
            btn.click();
            await sleep(500);
            return true;
          }
        }
        console.log('[X Tweet Cleaner] Confirm button not found');
        return false;
      }
      
      confirmButton.click();
      await sleep(500);
      
      return true;
      
    } catch (error) {
      console.error('[X Tweet Cleaner] Error deleting tweet:', error);
      return false;
    }
  }

  // Wait for an element to appear
  function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }
      
      const observer = new MutationObserver((mutations, obs) => {
        const element = document.querySelector(selector);
        if (element) {
          obs.disconnect();
          resolve(element);
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  }

  // Send message to popup
  function sendMessage(message) {
    try {
      chrome.runtime.sendMessage(message);
    } catch (e) {
      // Popup might be closed
      console.log('[X Tweet Cleaner] Could not send message:', message);
    }
  }

  // Sleep utility
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Random delay to seem more human
  function randomDelay() {
    return Math.random() * 1000; // 0-1000ms additional random delay
  }

  console.log('[X Tweet Cleaner] Content script loaded');
})();
