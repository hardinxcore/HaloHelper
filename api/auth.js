/**
 * Centralized authentication module for HaloPSA API calls
 * Uses the user's logged-in session cookies for authentication
 * This module is designed to work only in background scripts with full Chrome API access
 */

class HaloAuth {
    static requestCount = 0;
    static lastRequestTime = 0;
    static MAX_REQUESTS_PER_MINUTE = 30;

    static async getAccessToken() {
        try {
            const localStorage = await chrome.storage.local.get(['haloDomain']);
            
            if (!localStorage.haloDomain) {
                throw new Error('Halo domain not configured');
            }

            // Try to get the primary access token cookie
            let cookie = await chrome.cookies.get({ 
                'url': 'https://' + localStorage.haloDomain, 
                'name': 'access_token' 
            });

            if (cookie && cookie.value) {
                return cookie.value;
            }

            // Fallback: try to get backup cookies (used when token is too long for single cookie)
            const [cookie1, cookie2] = await Promise.all([
                chrome.cookies.get({ 
                    'url': 'https://' + localStorage.haloDomain, 
                    'name': 'access_token_shammam_1' 
                }),
                chrome.cookies.get({ 
                    'url': 'https://' + localStorage.haloDomain, 
                    'name': 'access_token_shammam_2' 
                })
            ]);

            if (cookie1 && cookie2 && cookie1.value && cookie2.value) {
                return cookie1.value + cookie2.value;
            }

            throw new Error('No valid access token found in cookies. Please ensure you are logged in to HaloPSA.');
        } catch (error) {
            console.error('Error getting access token:', error);
            throw error;
        }
    }

    static async makeAuthenticatedRequest(url, options = {}) {
        try {
            // Rate limiting
            const now = Date.now();
            if (now - this.lastRequestTime > 60000) {
                this.requestCount = 0;
                this.lastRequestTime = now;
            }
            
            if (this.requestCount >= this.MAX_REQUESTS_PER_MINUTE) {
                throw new Error('Rate limit exceeded. Please wait before making more requests.');
            }
            
            this.requestCount++;

            // Add input validation
            if (!url || typeof url !== 'string') {
                throw new Error('Invalid URL provided');
            }
            
            // Validate domain to prevent SSRF
            const allowedDomain = await this.getDomain();
            const urlObj = new URL(url);
            const allowedDomainObj = new URL(`https://${allowedDomain}`);
            
            if (urlObj.hostname !== allowedDomainObj.hostname) {
                throw new Error('Request to unauthorized domain blocked');
            }

            const token = await this.getAccessToken();
            
            const headers = new Headers(options.headers || {});
            headers.append("Authorization", "Bearer " + token);

            const requestOptions = {
                ...options,
                headers: headers
            };

            const response = await fetch(url, requestOptions);

            // Check if the request was unauthorized
            if (response.status === 401) {
                throw new Error('Authentication failed. Please refresh your HaloPSA session and try again.');
            }

            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
            }

            return response;
        } catch (error) {
            console.error('Error making authenticated request:', error);
            throw error;
        }
    }

    static async getDomain() {
        const localStorage = await chrome.storage.local.get(['haloDomain']);
        if (!localStorage.haloDomain) {
            throw new Error('Halo domain not configured');
        }
        return localStorage.haloDomain;
    }
}
