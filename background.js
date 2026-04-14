importScripts('/api/auth.js');
importScripts('/api/get-ticket.js');
importScripts('/api/update-ticket.js');

// Initialize extension settings on startup/install
chrome.runtime.onStartup.addListener(initializeSettings);
chrome.runtime.onInstalled.addListener(initializeSettings);

async function initializeSettings() {
    try {
        const localStorage = await chrome.storage.local.get();
        
        // Set default values if they don't exist
        const defaults = {
            haloDomain: '',  // Empty by default for open source users
            haloAddFormattedCopyButton: localStorage.haloAddFormattedCopyButton === undefined ? true : localStorage.haloAddFormattedCopyButton,
            haloTicketHistoryMax: localStorage.haloTicketHistoryMax === undefined ? 10 : localStorage.haloTicketHistoryMax,
            haloTicketHistory: localStorage.haloTicketHistory || [],
            haloPlanDateEnabled: localStorage.haloPlanDateEnabled === undefined ? true : localStorage.haloPlanDateEnabled,
            haloPlanDateFieldId: localStorage.haloPlanDateFieldId === undefined ? 239 : localStorage.haloPlanDateFieldId,
            haloPlanDateFieldName: localStorage.haloPlanDateFieldName === undefined ? 'Plandatum' : localStorage.haloPlanDateFieldName,
            haloPlanDateDashes: localStorage.haloPlanDateDashes === undefined ? true : localStorage.haloPlanDateDashes
        };
        
        // Only update values that are undefined
        let needsUpdate = false;
        const updates = {};
        
        for (const [key, value] of Object.entries(defaults)) {
            if (localStorage[key] === undefined) {
                updates[key] = value;
                needsUpdate = true;
            }
        }
        
        if (needsUpdate) {
            await chrome.storage.local.set(updates);
            console.log('Extension settings initialized successfully');
        }
        
    } catch (error) {
        console.error('Error initializing extension settings:', error);
    }
}

// Listen for omnibox
chrome.omnibox.onInputEntered.addListener((text) => {
    chrome.storage.local.get(['haloDomain'], (result) => {
        if (result.haloDomain == null || result.haloDomain == '')
            return;
        text = text.replace(/^0+/, ''); // Remove leading 0 otherwise javascript treats this as an octal number
        text = 'https://' + result.haloDomain + '/ticket?id=' + text;
        chrome.tabs.create({ url: text });
    });
});

// Listen for updated page to launch content scripts
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status != 'complete')
        return;

    // Skip if tab doesn't have a valid URL or is a special page
    if (!tab.url || 
        tab.url.startsWith('chrome://') || 
        tab.url.startsWith('about:') || 
        tab.url.startsWith('moz-extension://') || 
        tab.url.startsWith('chrome-extension://') ||
        tab.url.includes('about:blank') ||
        tab.url === 'about:blank') {
        return;
    }

    // Only proceed if it's a real HTTPS URL
    if (!tab.url.startsWith('https://')) {
        return;
    }

    // Small delay to ensure page is fully loaded
    await new Promise(resolve => setTimeout(resolve, 100));

    const localStorage = await chrome.storage.local.get();

    // If the halo domain has not been set, we can not do anything, just return
    if (localStorage.haloDomain == null || localStorage.haloDomain == '')
        return;

    let haloTicketHistory = localStorage.haloTicketHistory;
    if (!haloTicketHistory)
        haloTicketHistory = [];

    // Only inject script on actual HaloPSA domain pages
    if (tab.url.startsWith('https://' + localStorage.haloDomain) && localStorage.haloDomain) {
        try {
            // Very strict check - only inject on actual content pages
            if (tab.url.includes(localStorage.haloDomain) && 
                tab.url.startsWith('https://' + localStorage.haloDomain) &&
                !tab.url.includes('about:blank') && 
                !tab.url.includes('chrome://') &&
                !tab.url.includes('moz-extension://') &&
                tab.id && tab.id !== chrome.tabs.TAB_ID_NONE) {
                
                // Additional safety check - ensure tab is in a valid state
                const tabInfo = await chrome.tabs.get(tab.id);
                if (tabInfo && tabInfo.url && tabInfo.url.startsWith('https://' + localStorage.haloDomain)) {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id, allFrames: false },
                        func: CopyHaloAccessToken
                    });
                }
            }
        } catch (error) {
            // Completely silent for sandbox errors
            if (!error.message.includes('sandboxed') && 
                !error.message.includes('about:blank') &&
                !error.message.includes('Cannot access') &&
                !error.message.includes('frame')) {
                console.log('Could not inject script:', error.message);
            }
        }
    }

    // Inject content script on ALL Halo domain pages so the persistent
    // MutationObserver can detect ticket pages during SPA navigation.
    if (tab.url.startsWith('https://' + localStorage.haloDomain) && localStorage.haloDomain) {
        try {
            if (tab.url.includes(localStorage.haloDomain) &&
                !tab.url.includes('about:blank') &&
                !tab.url.includes('chrome://') &&
                !tab.url.includes('moz-extension://') &&
                tab.id && tab.id !== chrome.tabs.TAB_ID_NONE) {

                const tabInfo = await chrome.tabs.get(tab.id);
                if (tabInfo && tabInfo.url && tabInfo.url.startsWith('https://' + localStorage.haloDomain)) {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id, allFrames: false },
                        files: ['content-tickets.js']
                    });
                }
            }
        } catch (error) {
            if (!error.message.includes('sandboxed') &&
                !error.message.includes('about:blank') &&
                !error.message.includes('Cannot access') &&
                !error.message.includes('frame')) {
                console.log('Could not inject content script:', error.message);
            }
        }
    }

    // Ticket pages (/ticket and /tickets)
    if (tab.url.startsWith('https://' + localStorage.haloDomain) && tab.url.includes('/ticket')) {
        // Get ticket ID from page URL
        let url = new URL(tab.url);
        let urlSearchParams = new URLSearchParams(url.search);
        id = urlSearchParams.get('id');

        if (id != null) { // Do only on single ticket page, not a ticket list page
            id = id.replace(/^0+/, ''); // Remove leading 0 otherwise javascript treats this as an octal number
            let index = haloTicketHistory.findIndex(t => t.id == id)

            if (index != 0) { // if the ticket is already at the top of the array, we don't need to do anything
                let ticket = null;

                // if id is already somewhere in the array remove it
                if (index != -1)
                    ticket = haloTicketHistory.splice(index, 1)[0];

                // Get the full ticket data from the API
                if (!ticket)
                    ticket = await GetTicket(id);

                // Do if the API successfully returned a ticket
                if (ticket) {
                    // Add id to top of list
                    haloTicketHistory.unshift(ticket);
                    // Trim list to the maximun size
                    haloTicketHistory = haloTicketHistory.slice(0, localStorage.haloTicketHistoryMax);
                    // Save the list to local storage
                    chrome.storage.local.set({ 'haloTicketHistory': haloTicketHistory }, () => { });
                }
            }

            // Launch content script for ticket pages with improved error handling
            // (content-tickets.js is already injected on all Halo pages above,
            //  so this is a no-op safety net — the guard in the script prevents duplicates)
            try {
                if (tab.id && tab.id !== chrome.tabs.TAB_ID_NONE) {
                    await chrome.scripting.executeScript({
                        target: { tabId: tab.id, allFrames: false },
                        files: ['content-tickets.js']
                    });
                }
            } catch (error) {
                // silent
            }
        }
    }
});

// Message handler for content scripts that need authentication tokens
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Validate sender origin for security - but be more lenient during debugging
    if (!sender.tab || !sender.tab.url) {
        console.warn('No sender tab or URL:', sender);
        sendResponse({error: 'Invalid request sender'});
        return;
    }
    
    // Log for debugging
    console.log('Message received from:', sender.tab.url);
    
    if (!sender.tab.url.includes('.halopsa.com') && !sender.tab.url.includes('.haloitsm.com')) {
        console.warn('Unauthorized request origin:', sender.tab?.url);
        sendResponse({error: 'Unauthorized request origin'});
        return;
    }
    
    // Validate request structure
    if (!request.action || typeof request.action !== 'string') {
        sendResponse({error: 'Invalid request format'});
        return;
    }
    
    if (request.action === 'getAccessToken') {
        HaloAuth.getAccessToken()
            .then(token => sendResponse({token: token}))
            .catch(error => {
                console.error('Error getting access token:', error);
                sendResponse({error: 'Authentication failed. Please refresh your session.'});
            });
        return true; // Keep the message channel open for async response
    }
    
    if (request.action === 'getDomain') {
        HaloAuth.getDomain()
            .then(domain => sendResponse({domain: domain}))
            .catch(error => {
                console.error('Error getting domain:', error);
                sendResponse({error: 'Configuration error. Please check extension settings.'});
            });
        return true; // Keep the message channel open for async response
    }
    
    if (request.action === 'getTicket') {
        // Validate ticket ID
        if (!request.ticketId || typeof request.ticketId !== 'string') {
            sendResponse({error: 'Invalid ticket ID'});
            return;
        }
        
        // Sanitize ticket ID (only allow alphanumeric characters)
        const sanitizedTicketId = request.ticketId.replace(/[^a-zA-Z0-9]/g, '');
        if (!sanitizedTicketId) {
            sendResponse({error: 'Invalid ticket ID format'});
            return;
        }
        
        GetTicket(sanitizedTicketId)
            .then(ticket => sendResponse({ticket: ticket}))
            .catch(error => {
                console.error('Error getting ticket:', error);
                sendResponse({error: 'Failed to retrieve ticket data'});
            });
        return true; // Keep the message channel open for async response
    }
    
    if (request.action === 'getClient') {
        // Validate client ID
        if (!request.clientId) {
            sendResponse({error: 'Invalid client ID'});
            return;
        }
        
        // Sanitize client ID
        const sanitizedClientId = String(request.clientId).replace(/[^a-zA-Z0-9\-_]/g, '');
        if (!sanitizedClientId) {
            sendResponse({error: 'Invalid client ID format'});
            return;
        }
        
        console.log('Getting client data for ID:', sanitizedClientId);
        
        HaloAuth.getDomain()
            .then(domain => {
                // Try different API endpoint patterns for HaloPSA
                let apiUrl = `https://${domain}/api/clients/${sanitizedClientId}`;
                console.log('Making API request to:', apiUrl);
                return HaloAuth.makeAuthenticatedRequest(apiUrl, {
                    method: 'GET',
                    redirect: 'follow'
                }).catch(async (error) => {
                    // If the first endpoint fails, try alternative endpoints
                    console.log('First endpoint failed, trying alternatives...');
                    
                    // Try with different endpoint patterns
                    const alternatives = [
                        `https://${domain}/api/client/${sanitizedClientId}`,
                        `https://${domain}/api/clients?id=${sanitizedClientId}`,
                        `https://${domain}/api/client?id=${sanitizedClientId}`,
                        `https://${domain}/api/customers/${sanitizedClientId}`,
                        `https://${domain}/api/customer/${sanitizedClientId}`
                    ];
                    
                    for (const altUrl of alternatives) {
                        try {
                            console.log('Trying alternative endpoint:', altUrl);
                            const response = await HaloAuth.makeAuthenticatedRequest(altUrl, {
                                method: 'GET',
                                redirect: 'follow'
                            });
                            if (response.ok) {
                                console.log('Alternative endpoint succeeded:', altUrl);
                                return response;
                            }
                        } catch (altError) {
                            console.log(`Alternative endpoint ${altUrl} failed:`, altError.message);
                        }
                    }
                    
                    // If all alternatives fail, throw the original error
                    throw error;
                });
            })
            .then(response => {
                console.log('API response status:', response.status);
                if (!response.ok) {
                    throw new Error(`API request failed with status ${response.status}`);
                }
                return response.json();
            })
            .then(client => {
                console.log('Client data received:', client);
                sendResponse({client: client});
            })
            .catch(error => {
                console.error('Error getting client:', error);
                sendResponse({error: `Failed to retrieve client data: ${error.message}`});
            });
        return true; // Keep the message channel open for async response
    }

    if (request.action === 'bulkUpdatePlanDate') {
        if (!Array.isArray(request.ticketIds) || request.ticketIds.length === 0) {
            sendResponse({error: 'No ticket IDs provided'});
            return;
        }

        const sanitizedTicketIds = request.ticketIds
            .map(id => String(id || '').replace(/[^0-9]/g, ''))
            .filter(id => id.length > 0);

        if (sanitizedTicketIds.length === 0) {
            sendResponse({error: 'Invalid ticket IDs provided'});
            return;
        }

        const relativeDays = Number.isInteger(request.relativeDays) ? request.relativeDays : null;
        const absoluteDate = typeof request.absoluteDate === 'string' ? request.absoluteDate.trim() : '';

        if (relativeDays === null && !/^\d{4}-\d{2}-\d{2}$/.test(absoluteDate)) {
            sendResponse({error: 'Invalid date format. Use YYYY-MM-DD or relative days.'});
            return;
        }

        // Build plandatum lookup from DOM values sent by content script
        const plandatumByTicket = {};
        if (Array.isArray(request.ticketData)) {
            for (const t of request.ticketData) {
                if (t && t.id && t.plandatum) {
                    const cleanId = String(t.id).replace(/[^0-9]/g, '');
                    plandatumByTicket[cleanId] = t.plandatum;
                }
            }
        }

        // Read configured field ID from storage, then run the update
        chrome.storage.local.get('haloPlanDateFieldId').then(storageData => {
            const fieldId = storageData.haloPlanDateFieldId || 239;
            return BulkUpdateTicketPlanDate(sanitizedTicketIds, {
                relativeDays,
                absoluteDate: absoluteDate || null,
                plandatumByTicket,
                fieldId
            });
        })
            .then(result => sendResponse(result))
            .catch(error => {
                console.error('Bulk update failed:', error);
                sendResponse({error: error.message || 'Bulk update failed'});
            });

        return true;
    }
    
    // Unknown action
    sendResponse({error: 'Unknown action requested'});
});

// Sometimes for reasons I don't know the access token is stored in local storage instead of a cookie.
// This function copies from the halo website's local storage to the cookie so it can be used as a backup if the normal access_token is missing.
// The backup cookie is stored in 2 parts because the access token from local storage sometimes slightly exceedes the 4096 cookie size limit.
function CopyHaloAccessToken() {
    // Multiple safety checks to prevent execution in invalid contexts
    if (typeof window === 'undefined' || 
        typeof document === 'undefined' || 
        typeof localStorage === 'undefined' ||
        window.location.href.includes('about:blank') ||
        window.location.protocol !== 'https:') {
        return; // Silent exit for invalid contexts
    }
    
    try {
        // Only run on HaloPSA pages
        if (!window.location.hostname.endsWith('.halopsa.com') && !window.location.hostname.endsWith('.haloitsm.com')) {
            return;
        }

        // Check if we're in a frame or sandboxed context
        if (window.self !== window.top) {
            return; // Don't run in frames
        }

        let access_token = localStorage._access_token;
        if (typeof (access_token) == "undefined" || !access_token) {
            access_token = '';
        }

        // Validate token format before processing
        if (access_token && typeof access_token === 'string') {
            let access_token_shammam_1 = access_token.substring(0, 4000);
            let access_token_shammam_2 = access_token.substring(4000, 8000);
            
            // Set secure cookie flags
            let cookie1 = 'access_token_shammam_1=' + access_token_shammam_1 + '; Secure; SameSite=Strict';
            let cookie2 = 'access_token_shammam_2=' + access_token_shammam_2 + '; Secure; SameSite=Strict';
            
            document.cookie = cookie1;
            document.cookie = cookie2;
        }
    } catch (error) {
        // Complete silence for any errors - no logging at all
    }
}