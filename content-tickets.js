// Clear any existing timer and start a new one
if (typeof shammamTicketPageTimer !== 'undefined') {
    clearInterval(shammamTicketPageTimer);
}
var shammamTicketPageTimer = setInterval(AddShammamCopyButton, 250);

async function AddShammamCopyButton() {
    var localStorage = await chrome.storage.local.get();

    // Check the options to make sure the domain has been set and the copy button is turned on
    if (localStorage.haloAddFormattedCopyButton == false) {
        clearInterval(shammamTicketPageTimer);
        return;
    }

    // If the standard "Share" button does not exist yet, just exit without doing anything
    let shareITag = document.querySelector('i.fa.fa-share-alt');
    if (shareITag == null)
        return;
    clearInterval(shammamTicketPageTimer);

    // This function occasionally gets called again for some reason even after clearInterval is called
    // So check to see if we already added the button and quit if it is already there
    let shammamCopyLinkButton = document.querySelector('#ShammamCopyLinkButton');
    if (shammamCopyLinkButton != null)
        return;

    // Create new elements for the full info copy button
    let linkITag = document.createElement('i');
    linkITag.id = 'ShammamCopyLinkI';
    linkITag.setAttribute('class', 'fa fa-link');
    let linkButton = document.createElement('button');
    linkButton.id = 'ShammamCopyLinkButton';
    linkButton.setAttribute('class', 'solidbutton fabtn notext');
    linkButton.appendChild(linkITag);

    // Create new elements for the ticket number only copy button
    let numberITag = document.createElement('i');
    numberITag.id = 'ShammamCopyNumberI';
    numberITag.setAttribute('class', 'fa fa-hashtag');
    let numberButton = document.createElement('button');
    numberButton.id = 'ShammamCopyNumberButton';
    numberButton.setAttribute('class', 'solidbutton fabtn notext');
    numberButton.appendChild(numberITag);

    // Create new elements for the customer/account number copy button (company icon)
    let accountITag = document.createElement('i');
    accountITag.id = 'ShammamCopyAccountI';
    accountITag.setAttribute('class', 'fa fa-building');
    let accountButton = document.createElement('button');
    accountButton.id = 'ShammamCopyAccountButton';
    accountButton.setAttribute('class', 'solidbutton fabtn notext');
    accountButton.setAttribute('title', 'Copy customer account ID');
    accountButton.appendChild(accountITag);

    // Add new elements to DOM
    let shareButton = shareITag.closest('button');
    shareButton.after(numberButton);
    // place account button next to the ticket number button
    shareButton.after(accountButton);
    shareButton.after(linkButton);

    // Get ticket ID from page URL
    let url = new URL(window.location.href);
    let urlSearchParams = new URLSearchParams(url.search);
    ticketId = urlSearchParams.get('id');
    ticketId = ticketId.replace(/^0+/, ''); // Remove leading 0 otherwise javascript treats this as an octal number

    // Make api call using message passing to background script
    let ticket = null;
    try {
        ticket = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: 'getTicket',
                ticketId: ticketId
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (response.error) {
                    reject(new Error(response.error));
                } else {
                    resolve(response.ticket);
                }
            });
        });

        // Store ticket data securely without string injection
        linkButton.ticketData = {
            domain: localStorage.haloDomain,
            id: ticketId,
            client: ticket.client_name,
            summary: ticket.summary
        };
        
        numberButton.ticketData = {
            id: ticketId
        };

        // Use secure event listeners instead of onclick attributes
        linkButton.addEventListener('click', function() {
            const data = this.ticketData;
            ShammamCopy(data.domain, data.id, data.client, data.summary);
        });
        
        numberButton.addEventListener('click', function() {
            ShammamCopyNumber(this.ticketData.id);
        });
    } catch (error) {
        console.error('Error fetching ticket data:', error);
        // Still add the buttons even if API call fails - use secure event listeners
        linkButton.addEventListener('click', function() {
            ShammamCopy(localStorage.haloDomain, ticketId, 'Error loading client', 'Error loading summary');
        });
        
        numberButton.addEventListener('click', function() {
            ShammamCopyNumber(ticketId);
        });
    }

    // Try to find the "Customer ID for Accounting Integration" / $ACCOUNTSID efficiently
    // Prefer values already present in the ticket payload. Only if not found do a client API call.
    let accountId = null;
    if (ticket) {
        try {
            // quick heuristic search inside ticket object for common keys/fields
            function searchForAccountId(obj) {
                if (!obj || typeof obj !== 'object') return null;
                for (let k in obj) {
                    if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
                    try {
                        let val = obj[k];
                        if (val == null) continue;
                        let key = k.toString().toLowerCase();
                        if (key.includes('accountsid') || key.includes('accounts_id') || key.includes('customerid') || key.includes('customer_id') || key.includes('customer id') || key.includes('account id')) {
                            if (typeof val === 'string' || typeof val === 'number') return val.toString();
                        }
                        // custom fields often come as arrays/objects
                        if (typeof val === 'string' && (key.includes('customer') || key.includes('account'))) {
                            // value-only heuristics
                            if (/^[0-9\-]+$/.test(val)) return val;
                        }
                        if (typeof val === 'object') {
                            let r = searchForAccountId(val);
                            if (r) return r;
                        }
                    } catch (e) { }
                }
                return null;
            }

            accountId = searchForAccountId(ticket);
            console.log('Account ID search result:', accountId);
            console.log('Ticket client_id:', ticket?.client_id);
        } catch (e) { 
            console.error('Error searching for account ID:', e);
            accountId = null; 
        }
    }

    // If accountId was found in the ticket payload, wire a direct copy action.
    if (accountId != null) {
        accountButton.accountId = accountId;
        accountButton.addEventListener('click', function() {
            ShammamCopyAccountDirect(this.accountId);
        });
    }
    else if (ticket && ticket.client_id != null) {
        // otherwise lazy-load client details when button is clicked
        accountButton.clientData = {
            domain: localStorage.haloDomain,
            clientId: ticket.client_id
        };
        accountButton.addEventListener('click', async function() {
            try {
                await ShammamCopyAccountFetch(this.clientData.domain, this.clientData.clientId);
            } catch (error) {
                console.error('Error in account fetch:', error);
                ShammamCopyAccountNotFound();
            }
        });
    }
    else {
        // no place to look up the account id
        accountButton.addEventListener('click', function() {
            ShammamCopyAccountNotFound();
        });
    }
}

function ShammamCopy(HaloDomain, TicketId, TicketClient, TicketSummary) {
    // Build the ticket link and description from the parameters passed
    let ticketLink = 'https://' + HaloDomain + '/ticket?id=' + TicketId;
    let ticketDescription = '';

    // New format: TICKETID // ORGANIZATION NAME // TICKET TITLE
    ticketDescription = TicketId;
    ticketDescription += TicketClient != null ? ' // ' + TicketClient : '';
    ticketDescription += TicketSummary != null ? ' // ' + TicketSummary : '';


    // Using information collected, constuct link tag and add it to bottom of page. It think it should be close to no extra styling.
    let newLink = document.createElement('a');
    newLink.setAttribute('style', 'font-size:12pt');
    newLink.setAttribute('href', ticketLink);
    newLink.innerHTML = ticketDescription;
    document.getElementsByTagName('body')[0].appendChild(newLink);

    // Unselect any current selection, then select the link added to the page above.
    window.getSelection().removeAllRanges();
    let range = document.createRange();
    range.selectNode(newLink);
    window.getSelection().addRange(range);

    // Copy link
    document.execCommand('copy');

    // Remove link that we had added.
    newLink.remove();

    // Change styling of Shammam button to a check mark
    document.querySelector('#ShammamCopyLinkI').setAttribute('class', 'fa fa-check-circle');

    // After a couple seconds revert Shammam button back to normal styling
    let p = new Promise((resolve, reject) => {
        // Setting 2000 ms time
        setTimeout(resolve, 3000);
    }).then(() => {
        document.querySelector('#ShammamCopyLinkI').setAttribute('class', 'fa fa-link');
    });
}

function ShammamCopyNumber(TicketId) {
    // Copy ticket number as trimmed plaintext using modern Clipboard API with fallback
    CopyPlainTextToClipboard(TicketId);

    // Change styling of number button to a check mark
    document.querySelector('#ShammamCopyNumberI').setAttribute('class', 'fa fa-check-circle');

    // After a couple seconds revert number button back to normal styling
    let p = new Promise((resolve, reject) => {
        setTimeout(resolve, 3000);
    }).then(() => {
        document.querySelector('#ShammamCopyNumberI').setAttribute('class', 'fa fa-hashtag');
    });
}

// Copy account id directly (value already known)
function ShammamCopyAccountDirect(AccountId) {
    // Copy account id as trimmed plaintext using modern Clipboard API with fallback
    CopyPlainTextToClipboard(AccountId);

    // Change styling of account button to a check mark
    let el = document.querySelector('#ShammamCopyAccountI');
    if (el) el.setAttribute('class', 'fa fa-check-circle');

    // After a couple seconds revert account button back to building icon
    let p = new Promise((resolve, reject) => {
        setTimeout(resolve, 3000);
    }).then(() => {
        let e2 = document.querySelector('#ShammamCopyAccountI');
        if (e2) e2.setAttribute('class', 'fa fa-building');
    });
}

// Helper: copy trimmed plaintext to clipboard, use navigator.clipboard when possible with a safe fallback
function CopyPlainTextToClipboard(text) {
    let s = '' + (text == null ? '' : text);
    s = s.trim();

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(s).catch(() => {
            // fallback to execCommand if writeText fails
            let ta = document.createElement('textarea');
            ta.value = s;
            // ensure out of view and not influence layout
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            ta.style.top = '0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); } catch (e) { }
            ta.remove();
        });
        return;
    }

    // fallback for older browsers
    let textarea = document.createElement('textarea');
    textarea.value = s;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try { document.execCommand('copy'); } catch (e) { }
    textarea.remove();
}

// Fetch client details and try to extract the account id ($ACCOUNTSID / Customer ID for Accounting Integration)
async function ShammamCopyAccountFetch(HaloDomain, ClientId) {
    try {
        // Show spinner/feedback by swapping icon
        let el = document.querySelector('#ShammamCopyAccountI');
        if (el) el.setAttribute('class', 'fa fa-spinner fa-spin');

        console.log('Fetching client data for ID:', ClientId, 'on domain:', HaloDomain);

        // Request client data from background script
        const client = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: 'getClient',
                clientId: ClientId
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (response.error) {
                    reject(new Error(response.error));
                } else if (response.client) {
                    resolve(response.client);
                } else {
                    reject(new Error('No client data received'));
                }
            });
        });

        console.log('Client data received:', client);
        console.log('Client data keys:', Object.keys(client));

        // Enhanced search for the account ID in client data
        function searchForAccountId(obj, path = '') {
            if (!obj || typeof obj !== 'object') return null;
            
            // First, check if this is a customfields array similar to what we do for tickets
            if (Array.isArray(obj)) {
                console.log(`Searching in array at ${path}, length:`, obj.length);
                for (let i = 0; i < obj.length; i++) {
                    let field = obj[i];
                    if (field && typeof field === 'object') {
                        // HaloPSA custom fields often have structure like {name: "Field Name", value: "Field Value"}
                        if (field.name && field.value) {
                            let fieldName = field.name.toString().toLowerCase();
                            console.log(`Checking custom field: ${field.name} = ${field.value}`);
                            if (fieldName.includes('account') || fieldName.includes('customer') || 
                                fieldName.includes('client id') || fieldName.includes('accounts') ||
                                fieldName.includes('integration') || fieldName.includes('external') ||
                                fieldName.includes('erp') || fieldName.includes('billing')) {
                                let value = field.value.toString().trim();
                                if (value && value !== '0' && value !== '' && !/^[0\s]*$/.test(value)) {
                                    console.log(`Found account ID in custom field: ${value} (field: ${field.name})`);
                                    return value;
                                }
                            }
                        }
                        // Also check if it has id/label structure
                        if (field.id && field.label && field.value) {
                            let fieldLabel = field.label.toString().toLowerCase();
                            console.log(`Checking labeled field: ${field.label} = ${field.value}`);
                            if (fieldLabel.includes('account') || fieldLabel.includes('customer') || 
                                fieldLabel.includes('client id') || fieldLabel.includes('accounts') ||
                                fieldLabel.includes('integration') || fieldLabel.includes('external') ||
                                fieldLabel.includes('erp') || fieldLabel.includes('billing')) {
                                let value = field.value.toString().trim();
                                if (value && value !== '0' && value !== '' && !/^[0\s]*$/.test(value)) {
                                    console.log(`Found account ID in labeled field: ${value} (label: ${field.label})`);
                                    return value;
                                }
                            }
                        }
                        // Recursively search nested objects
                        let r = searchForAccountId(field, `${path}[${i}]`);
                        if (r) return r;
                    }
                }
                return null;
            }
            
            // Standard object property search
            for (let k in obj) {
                if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
                try {
                    let val = obj[k];
                    if (val == null) continue;
                    let key = k.toString().toLowerCase();
                    let currentPath = path ? `${path}.${k}` : k;
                    
                    console.log(`Checking property: ${currentPath} = ${val}`);
                    
                    // Enhanced search patterns for account IDs
                    if (key.includes('accountsid') || key.includes('accounts_id') || 
                        key.includes('customerid') || key.includes('customer_id') || 
                        key.includes('customer id') || key.includes('account id') ||
                        key.includes('cfaccountsid') || key.includes('cf_accountsid') ||
                        key.includes('cfcustomerid') || key.includes('cf_customerid') ||
                        key === 'cf1' || key === 'cf2' || key === 'cf3' || key === 'cf4' || key === 'cf5' ||
                        key.includes('customfield') || key.includes('custom_field') ||
                        key.includes('external') || key.includes('integration') ||
                        key.includes('erp') || key.includes('billing') || key.includes('account')) {
                        if (typeof val === 'string' || typeof val === 'number') {
                            let stringVal = val.toString().trim();
                            if (stringVal && stringVal !== '0' && stringVal !== '' && !/^[0\s]*$/.test(stringVal)) {
                                console.log(`Found potential account ID: ${stringVal} at ${currentPath}`);
                                return stringVal;
                            }
                        }
                    }
                    
                    // Look for numeric values in likely fields that might contain account IDs
                    if (typeof val === 'string' && (key.includes('customer') || key.includes('account') || key.includes('cf') || key.includes('field'))) {
                        // Enhanced value-only heuristics for account IDs
                        if (/^[0-9]{3,15}$/.test(val.trim()) && val.trim() !== '0') {
                            console.log(`Found potential numeric account ID: ${val} at ${currentPath}`);
                            return val.trim();
                        }
                    }
                    
                    // Recursively search nested objects and arrays
                    if (typeof val === 'object') {
                        let r = searchForAccountId(val, currentPath);
                        if (r) return r;
                    }
                } catch (e) { 
                    console.log(`Error searching in ${currentPath}:`, e);
                }
            }
            return null;
        }

        let accountId = searchForAccountId(client);
        console.log('Final account ID found:', accountId);

        if (accountId != null && accountId !== '0') {
            ShammamCopyAccountDirect(accountId);
            return;
        }

        // if still not found, show not found feedback
        console.log('Account ID not found in client data, showing not found feedback');
        ShammamCopyAccountNotFound();
    }
    catch (e) {
        console.log('Error fetching client for account id:', e);
        
        // Show more helpful error message
        let el = document.querySelector('#ShammamCopyAccountI');
        if (el) {
            el.setAttribute('class', 'fa fa-exclamation-triangle');
            el.setAttribute('title', 'Could not fetch client data. The account ID may need to be found manually.');
        }
        
        // Revert to building icon after a while
        setTimeout(() => {
            let e2 = document.querySelector('#ShammamCopyAccountI');
            if (e2) {
                e2.setAttribute('class', 'fa fa-building');
                e2.setAttribute('title', 'Copy account ID');
            }
        }, 5000); // Longer timeout to show the error
    }
}

function ShammamCopyAccountNotFound() {
    let el = document.querySelector('#ShammamCopyAccountI');
    if (el) {
        el.setAttribute('class', 'fa fa-question-circle');
        el.setAttribute('title', 'Account ID not found automatically. Check client details manually.');
    }

    // Show a more helpful message in console
    console.log('Account ID not found. You may need to:');
    console.log('1. Check the client record in HaloPSA for custom fields containing the account ID');
    console.log('2. Look for fields like "Customer ID", "Account ID", "External ID", or "ERP ID"');
    console.log('3. Update the search function if the field has a different name');

    // revert icon after a while
    let p = new Promise((resolve, reject) => {
        setTimeout(resolve, 5000);
    }).then(() => {
        let e2 = document.querySelector('#ShammamCopyAccountI');
        if (e2) {
            e2.setAttribute('class', 'fa fa-building');
            e2.setAttribute('title', 'Copy customer account ID');
        }
    });
}