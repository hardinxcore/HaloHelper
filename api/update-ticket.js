// Bulk-update the CFPlandatum custom field (id: 239) for multiple tickets
// using the standard HaloPSA POST /api/Tickets endpoint.
//
// Field ID 239 is used directly — the GET /api/tickets/{id} endpoint does not
// reliably return customfields for all ticket types, but POST always accepts it.
//
// For relative shifts, the current plandatum is read from the DOM (passed by the
// content script) to avoid unreliable GET responses.

// Field ID is now configurable via extension options (default: 239)

/**
 * Parse a display-format date string (DD/MM/YYYY or YYYY-MM-DD) into a Date.
 */
function parsePlandatumDisplay(str) {
    if (!str) return null;
    str = str.trim();
    // Try DD/MM/YYYY (HaloPSA display format)
    const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) {
        const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
        if (!isNaN(d.getTime())) return d;
    }
    // Try ISO YYYY-MM-DD
    const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
        const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
        if (!isNaN(d.getTime())) return d;
    }
    // Last resort: native parser
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
}

async function BulkUpdateTicketPlanDate(ticketIds, updateConfig) {
    const domain = await HaloAuth.getDomain();
    const results = [];
    const plandatumByTicket = updateConfig.plandatumByTicket || {};

    console.log('[HaloHelper] BulkUpdateTicketPlanDate called', { ticketIds, updateConfig, domain });

    for (const ticketId of ticketIds) {
        try {
            let newDateStr;

            if (typeof updateConfig.relativeDays === 'number') {
                // Use the plandatum value from the DOM (passed by content script)
                const currentDisplay = plandatumByTicket[ticketId] || '';
                const baseDate = parsePlandatumDisplay(currentDisplay);

                if (!baseDate) {
                    throw new Error('Current Plandatum is empty or invalid — cannot apply relative shift');
                }

                const shifted = new Date(baseDate);
                shifted.setDate(shifted.getDate() + updateConfig.relativeDays);
                newDateStr = shifted.toISOString().slice(0, 10) + 'T10:00:00';
            } else if (updateConfig.absoluteDate) {
                newDateStr = updateConfig.absoluteDate + 'T10:00:00';
            } else {
                throw new Error('No valid date or shift provided');
            }

            console.log(`[HaloHelper] Updating ticket ${ticketId} plandatum to ${newDateStr}`);

            const response = await HaloAuth.makeAuthenticatedRequest(`https://${domain}/api/Tickets`, {
                method: 'POST',
                redirect: 'follow',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([{
                    id: Number(ticketId),
                    customfields: [{ id: updateConfig.fieldId || 239, value: newDateStr }]
                }])
            });

            // Consume response to verify success
            const body = await response.json();
            const returned = Array.isArray(body) ? body : [body];
            const match = returned.find(t => String(t.id) === String(ticketId));
            if (!match) {
                throw new Error('API did not return updated ticket data');
            }

            results.push({ ticketId, success: true, date: newDateStr.slice(0, 10) });
        } catch (error) {
            console.error(`[HaloHelper] Failed to update ticket ${ticketId}:`, error);
            results.push({ ticketId, success: false, error: error.message || 'Unknown error' });
        }
    }

    return {
        successCount: results.filter(r => r.success).length,
        failureCount: results.filter(r => !r.success).length,
        results
    };
}
