// Halo is a SPA – the window persists across in-app navigations while the URL
// changes via history.pushState.  We set up ONE persistent MutationObserver that
// re-evaluates the current page type on every (debounced) DOM mutation so that
// buttons appear/disappear correctly without needing re-injection from background.
(function initHaloExtension() {
    // Only set up once per page lifetime
    if (window._haloExtensionActive) return;
    window._haloExtensionActive = true;

    // --- Continuously track selected ticket IDs so we have them BEFORE any click ---
    // HaloPSA deselects checkboxes when focus moves away from the table, so we
    // snapshot on every change event.
    window._haloSelectedTickets = [];

    document.addEventListener('change', (event) => {
        const target = event.target;
        if (!target || !target.matches || !target.matches('input[type="checkbox"]')) return;
        // Debounce slightly to let React finish updating
        clearTimeout(window._haloSelectionTimer);
        window._haloSelectionTimer = setTimeout(() => {
            window._haloSelectedTickets = collectSelectedTickets();
            refreshBulkPlanDateButtonLabel();
        }, 50);
    }, true);

    let lastCheckedHref = '';

    const schedulePageCheck = createDebouncedCallback(async () => {
        const currentHref = window.location.href;
        const hrefChanged = currentHref !== lastCheckedHref;
        lastCheckedHref = currentHref;

        const localStorage = await chrome.storage.local.get();

        // --- Single ticket page: copy buttons ---
        if (localStorage.haloAddFormattedCopyButton !== false) {
            const shareITag = document.querySelector('i.fa.fa-share-alt');
            if (shareITag && !document.querySelector('#ShammamCopyLinkButton')) {
                AddShammamCopyButton(shareITag, localStorage);
            }
        }

        // --- Ticket list page: bulk plan-date button ---
        if (isTicketListPage()) {
            ensureBulkPlanDateButton();
        } else {
            const bulkBtn = document.querySelector('#ShammamBulkPlanDateButton');
            if (bulkBtn) bulkBtn.remove();
            const selectAllBtn = document.querySelector('#ShammamSelectAllButton');
            if (selectAllBtn) selectAllBtn.remove();
        }
    }, 150);

    const observer = new MutationObserver(() => {
        schedulePageCheck();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Run immediately on first injection
    schedulePageCheck();
})();

// ============================================================
//  Utility
// ============================================================

function createDebouncedCallback(callback, waitMs) {
    let timeoutId = null;
    return function debouncedCallback() {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => { timeoutId = null; callback(); }, waitMs);
    };
}

// ============================================================
//  Page type detection
// ============================================================

function isTicketListPage() {
    if (/\/tickets(\/|\?|$)/i.test(window.location.pathname)) return true;
    if (/\/tickets(\/|\?|$)/i.test(window.location.hash)) return true;
    // DOM fallback: .rt-tr-group rows with ticket IDs
    const rows = document.querySelectorAll('.rt-tr-group[id]');
    if (rows.length >= 1) return true;
    return false;
}

// ============================================================
//  Selection tracking  (reads .rt-tr-group rows with checked checkboxes)
// ============================================================

function collectSelectedTickets() {
    const tickets = [];

    // Dynamically find column indices by scanning header text
    const headers = document.querySelectorAll('.rt-thead .rt-th');
    let summaryIdx = -1, plandatumIdx = -1;
    headers.forEach((h, idx) => {
        const text = h.textContent.trim().toLowerCase();
        if (text === 'summary') summaryIdx = idx;
        if (text === 'plandatum') plandatumIdx = idx;
    });

    const rows = document.querySelectorAll('.rt-tr-group[id]');
    for (const row of rows) {
        const cb = row.querySelector('input[type="checkbox"]');
        if (!cb || !cb.checked) continue;
        const ticketId = row.id.replace(/^0+/, '');
        if (!ticketId || !/^\d+$/.test(ticketId)) continue;

        const cells = row.querySelectorAll('.rt-td');
        const summary = summaryIdx >= 0 && cells[summaryIdx]
            ? cells[summaryIdx].textContent.trim() : '';
        const plandatum = plandatumIdx >= 0 && cells[plandatumIdx]
            ? cells[plandatumIdx].textContent.trim() : '';

        tickets.push({ id: ticketId, summary, plandatum });
    }
    return tickets;
}

// ============================================================
//  Bulk plan-date button
// ============================================================

function ensureBulkPlanDateButton() {
    if (document.querySelector('#ShammamBulkPlanDateButton')) return;

    const button = document.createElement('button');
    button.id = 'ShammamBulkPlanDateButton';
    button.setAttribute('class', 'solidbutton');
    button.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;padding:10px 16px;border-radius:6px;box-shadow:0 2px 10px rgba(0,0,0,0.3);font-size:13px;cursor:pointer;';

    // Use mousedown + preventDefault so HaloPSA doesn't deselect checkboxes
    button.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onBulkPlanDateClicked();
    });

    document.body.appendChild(button);

    // Add Select All / Deselect All toggle button
    const selectAllBtn = document.createElement('button');
    selectAllBtn.id = 'ShammamSelectAllButton';
    selectAllBtn.setAttribute('class', 'solidbutton');
    selectAllBtn.style.cssText = 'position:fixed;right:16px;bottom:56px;z-index:2147483647;padding:6px 12px;border-radius:6px;box-shadow:0 2px 10px rgba(0,0,0,0.3);font-size:11px;cursor:pointer;';
    selectAllBtn.innerHTML = '<i class="fa fa-check-square" style="margin-right:4px"></i>Select all';
    selectAllBtn._allSelected = false;

    selectAllBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSelectAllTickets(selectAllBtn);
    });

    document.body.appendChild(selectAllBtn);

    refreshBulkPlanDateButtonLabel();
}

async function toggleSelectAllTickets(btn) {
    const shouldSelect = !btn._allSelected;

    // Click checkboxes one at a time, re-querying after each click
    // because React re-renders the table and invalidates old DOM references.
    let safety = 200;
    while (safety-- > 0) {
        const checkboxes = document.querySelectorAll('.rt-tr-group[id] input[type="checkbox"]');
        let found = false;
        for (const cb of checkboxes) {
            if (cb.checked !== shouldSelect) {
                cb.click();
                found = true;
                await new Promise(r => setTimeout(r, 30));
                break; // re-query after each click
            }
        }
        if (!found) break;
    }

    btn._allSelected = shouldSelect;
    btn.innerHTML = shouldSelect
        ? '<i class="fa fa-square-o" style="margin-right:4px"></i>Deselect all'
        : '<i class="fa fa-check-square" style="margin-right:4px"></i>Select all';

    // Update selection tracking
    window._haloSelectedTickets = collectSelectedTickets();
    refreshBulkPlanDateButtonLabel();
}

function refreshBulkPlanDateButtonLabel() {
    const button = document.querySelector('#ShammamBulkPlanDateButton');
    if (!button) return;
    // Use live snapshot if checkboxes are still checked, otherwise fall back to stored snapshot
    const liveSelection = collectSelectedTickets();
    const count = liveSelection.length > 0 ? liveSelection.length : window._haloSelectedTickets.length;
    button.innerHTML = count > 0
        ? '<i class="fa fa-calendar" style="margin-right:6px"></i>Bulk plan date (' + count + ')'
        : '<i class="fa fa-calendar" style="margin-right:6px"></i>Bulk plan date';
}

// ============================================================
//  Modal UI  (dark theme matching HaloPSA)
// ============================================================

function showBulkPlanDateModal(tickets) {
    // Remove any existing modal
    const existing = document.querySelector('#ShammamBulkModal');
    if (existing) existing.remove();

    // Default date: today + 7 days
    const defaultDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

    const overlay = document.createElement('div');
    overlay.id = 'ShammamBulkModal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,sans-serif;';

    const ticketRows = tickets.map(t =>
        `<tr style="border-bottom:1px solid #2d2d4a;">
            <td style="padding:6px 10px;color:#4dd0e1;font-weight:600;">${escapeHtml(t.id)}</td>
            <td style="padding:6px 10px;color:#ccc;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(t.summary || '—')}</td>
            <td style="padding:6px 10px;color:#aaa;">${escapeHtml(t.plandatum || '—')}</td>
        </tr>`
    ).join('');

    overlay.innerHTML = `
        <div style="background:#1a1a2e;border:1px solid #2d2d4a;border-radius:10px;padding:24px;width:620px;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
            <h3 style="margin:0 0 16px;color:#e0e0e0;font-size:16px;">
                <i class="fa fa-calendar" style="margin-right:8px;color:#4dd0e1;"></i>
                Bulk update Plandatum
            </h3>

            <div style="margin-bottom:14px;">
                <label style="color:#aaa;font-size:13px;display:block;margin-bottom:6px;">New plan date</label>
                <input type="date" id="ShammamBulkDateInput" value="${defaultDate}"
                    style="background:#16213e;border:1px solid #2d2d4a;color:#e0e0e0;padding:8px 12px;border-radius:6px;font-size:14px;width:100%;box-sizing:border-box;">
            </div>

            <div style="margin-bottom:14px;">
                <label style="color:#aaa;font-size:13px;display:block;margin-bottom:6px;">Or shift relative to current date</label>
                <div style="display:flex;gap:8px;">
                    <button class="shammam-shift-btn" data-days="7" style="background:#16213e;border:1px solid #2d2d4a;color:#4dd0e1;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:13px;">+7 days</button>
                    <button class="shammam-shift-btn" data-days="14" style="background:#16213e;border:1px solid #2d2d4a;color:#4dd0e1;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:13px;">+14 days</button>
                    <button class="shammam-shift-btn" data-days="1" style="background:#16213e;border:1px solid #2d2d4a;color:#4dd0e1;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:13px;">+1 day</button>
                </div>
            </div>

            <div style="flex:1;overflow-y:auto;margin-bottom:14px;border:1px solid #2d2d4a;border-radius:6px;">
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <thead>
                        <tr style="background:#16213e;">
                            <th style="padding:8px 10px;text-align:left;color:#4dd0e1;font-weight:600;">Ticket</th>
                            <th style="padding:8px 10px;text-align:left;color:#4dd0e1;font-weight:600;">Summary</th>
                            <th style="padding:8px 10px;text-align:left;color:#4dd0e1;font-weight:600;">Plandatum</th>
                        </tr>
                    </thead>
                    <tbody>${ticketRows}</tbody>
                </table>
            </div>

            <div id="ShammamBulkStatus" style="display:none;margin-bottom:10px;padding:8px 10px;border-radius:6px;font-size:13px;"></div>

            <div style="display:flex;justify-content:flex-end;gap:10px;">
                <button id="ShammamBulkCancel" style="background:transparent;border:1px solid #2d2d4a;color:#aaa;padding:8px 20px;border-radius:6px;cursor:pointer;font-size:13px;">Cancel</button>
                <button id="ShammamBulkApply" style="background:#4dd0e1;border:none;color:#1a1a2e;padding:8px 20px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">Apply</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // State: absolute date mode by default
    let updateMode = { absoluteDate: defaultDate, relativeDays: null };

    // Wire date input
    const dateInput = overlay.querySelector('#ShammamBulkDateInput');
    dateInput.addEventListener('change', () => {
        updateMode = { absoluteDate: dateInput.value, relativeDays: null };
        // Deselect shift buttons
        overlay.querySelectorAll('.shammam-shift-btn').forEach(b => b.style.background = '#16213e');
    });

    // Wire shift buttons
    overlay.querySelectorAll('.shammam-shift-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const days = parseInt(btn.getAttribute('data-days'), 10);
            updateMode = { absoluteDate: null, relativeDays: days };
            dateInput.value = '';
            // Highlight active
            overlay.querySelectorAll('.shammam-shift-btn').forEach(b => b.style.background = '#16213e');
            btn.style.background = '#2d2d4a';
        });
    });

    // Wire cancel
    overlay.querySelector('#ShammamBulkCancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    // Wire apply
    overlay.querySelector('#ShammamBulkApply').addEventListener('click', () => {
        executeBulkUpdate(tickets, updateMode, overlay);
    });
}

async function executeBulkUpdate(tickets, updateMode, overlay) {
    const applyBtn = overlay.querySelector('#ShammamBulkApply');
    const cancelBtn = overlay.querySelector('#ShammamBulkCancel');
    const statusDiv = overlay.querySelector('#ShammamBulkStatus');

    // Validate
    if (!updateMode.absoluteDate && updateMode.relativeDays == null) {
        statusDiv.style.display = 'block';
        statusDiv.style.background = '#4a1a1a';
        statusDiv.style.color = '#ff6b6b';
        statusDiv.textContent = 'Please select a date or a relative shift.';
        return;
    }

    // Loading state
    applyBtn.disabled = true;
    applyBtn.textContent = 'Updating...';
    cancelBtn.disabled = true;
    statusDiv.style.display = 'block';
    statusDiv.style.background = '#1a2a3e';
    statusDiv.style.color = '#4dd0e1';
    statusDiv.textContent = `Updating ${tickets.length} ticket(s)...`;

    try {
        const ticketIds = tickets.map(t => t.id);
        const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                action: 'bulkUpdatePlanDate',
                ticketIds: ticketIds,
                absoluteDate: updateMode.absoluteDate,
                relativeDays: updateMode.relativeDays
            }, (result) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (!result) {
                    reject(new Error('No response from extension'));
                } else if (result.error) {
                    reject(new Error(result.error));
                } else {
                    resolve(result);
                }
            });
        });

        // Show result
        if (response.failureCount === 0) {
            statusDiv.style.background = '#1a3a2a';
            statusDiv.style.color = '#4dd0e1';
            statusDiv.textContent = `Successfully updated ${response.successCount} ticket(s).`;
        } else {
            const failedDetails = response.results.filter(r => !r.success).map(r => `${r.ticketId}: ${r.error || 'Unknown error'}`).join('\n');
            statusDiv.style.background = '#4a1a1a';
            statusDiv.style.color = '#ff6b6b';
            statusDiv.style.whiteSpace = 'pre-wrap';
            statusDiv.textContent = `Updated ${response.successCount}/${ticketIds.length}.\n${failedDetails}`;
        }

        applyBtn.textContent = 'Done';
        applyBtn.disabled = false;
        cancelBtn.disabled = false;
        cancelBtn.textContent = 'Close';

        // Auto-close after 2s on full success and refresh the page
        if (response.failureCount === 0) {
            setTimeout(() => {
                overlay.remove();
                window.location.reload();
            }, 1500);
        }
    } catch (error) {
        statusDiv.style.background = '#4a1a1a';
        statusDiv.style.color = '#ff6b6b';
        statusDiv.textContent = `Error: ${error.message}`;
        applyBtn.textContent = 'Retry';
        applyBtn.disabled = false;
        cancelBtn.disabled = false;
    }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ============================================================
//  Click handler
// ============================================================

function onBulkPlanDateClicked() {
    // Use live selection first, fall back to stored snapshot
    let tickets = collectSelectedTickets();
    if (tickets.length === 0) {
        tickets = window._haloSelectedTickets || [];
    }

    if (tickets.length === 0) {
        showBulkPlanDateNotice('Select at least one ticket first.');
        return;
    }

    showBulkPlanDateModal(tickets);
}

function showBulkPlanDateNotice(message) {
    let notice = document.querySelector('#ShammamBulkPlanDateNotice');
    if (!notice) {
        notice = document.createElement('div');
        notice.id = 'ShammamBulkPlanDateNotice';
        notice.style.cssText = 'position:fixed;right:16px;bottom:64px;z-index:2147483647;background:#1f2937;color:#fff;padding:10px 14px;border-radius:6px;font-size:13px;max-width:320px;box-shadow:0 2px 10px rgba(0,0,0,0.3);';
        document.body.appendChild(notice);
    }
    notice.textContent = message;
    clearTimeout(notice._hideTimeout);
    notice._hideTimeout = setTimeout(() => { notice.remove(); }, 4500);
}

async function AddShammamCopyButton(shareITag, localStorage) {

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

        // Extract "Externe referentie klant" (KLANTID) from ticket custom fields
        // Prefer exact field name: CFCustomerExternalReference
        let klantId = null;
        if (ticket.customfields && Array.isArray(ticket.customfields)) {
            for (const field of ticket.customfields) {
                if (!field) continue;
                const fieldName = (field.name || field.fieldname || field.label || field.id || '').toString().toLowerCase();

                // Primary match requested by user
                const isExactExternalRefField = fieldName === 'cfcustomerexternalreference';

                // Fallback match for tenants using translated/custom labels
                const isFallbackMatch =
                    fieldName.includes('externe referentie') ||
                    fieldName.includes('klantid') ||
                    fieldName.includes('external reference');

                if (isExactExternalRefField || isFallbackMatch) {
                    const val = (field.value || '').toString().trim();
                    if (val && val !== '0') {
                        klantId = val;
                        break;
                    }
                }
            }
        }

        // Store ticket data securely without string injection
        linkButton.ticketData = {
            domain: localStorage.haloDomain,
            id: ticketId,
            klantId: klantId,
            client: ticket.client_name,
            summary: ticket.summary
        };
        
        numberButton.ticketData = {
            id: ticketId
        };

        // Use secure event listeners instead of onclick attributes
        linkButton.addEventListener('click', function() {
            const data = this.ticketData;
            ShammamCopy(data.domain, data.id, data.klantId, data.client, data.summary);
        });
        
        numberButton.addEventListener('click', function() {
            ShammamCopyNumber(this.ticketData.id);
        });
    } catch (error) {
        console.error('Error fetching ticket data:', error);
        // Still add the buttons even if API call fails - use secure event listeners
        linkButton.addEventListener('click', function() {
            ShammamCopy(localStorage.haloDomain, ticketId, null, 'Error loading client', 'Error loading summary');
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

async function ShammamCopy(HaloDomain, TicketId, KlantId, TicketClient, TicketSummary) {
    // Build the ticket link and description from the parameters passed
    let ticketLink = 'https://' + HaloDomain + '/ticket?id=' + TicketId;
    
    // Format: TICKETID // KLANTID // ORGANIZATION NAME // TICKET TITLE
    let ticketDescription = TicketId;
    ticketDescription += KlantId != null ? ' // ' + KlantId : '';
    ticketDescription += TicketClient != null ? ' // ' + TicketClient : '';
    ticketDescription += TicketSummary != null ? ' // ' + TicketSummary : '';

    try {
        const htmlContent = `<a href="${ticketLink}" style="font-size:12pt">${ticketDescription}</a>`;
        
        const clipboardItem = new ClipboardItem({
            'text/html': new Blob([htmlContent], { type: 'text/html' }),
            'text/plain': new Blob([ticketDescription], { type: 'text/plain' })
        });
        
        await navigator.clipboard.write([clipboardItem]);
    } catch (err) {
        console.error('Failed to copy: ', err);
        // Fallback for older browsers
        CopyPlainTextToClipboard(ticketDescription);
    }

    // Change styling of Shammam button to a check mark
    let linkI = document.querySelector('#ShammamCopyLinkI');
    if (linkI) linkI.setAttribute('class', 'fa fa-check-circle');

    // After a couple seconds revert Shammam button back to normal styling
    setTimeout(() => {
        let linkIRev = document.querySelector('#ShammamCopyLinkI');
        if (linkIRev) linkIRev.setAttribute('class', 'fa fa-link');
    }, 3000);
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