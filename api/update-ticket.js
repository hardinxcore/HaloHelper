// Bulk-update the CFPlandatum custom field (id: 239) for multiple tickets
// using the standard HaloPSA POST /api/Tickets endpoint.
//
// Field ID 239 is used directly — the GET /api/tickets/{id} endpoint does not
// reliably return customfields for all ticket types, but POST always accepts it.

const PLANDATUM_FIELD_ID = 239;

async function BulkUpdateTicketPlanDate(ticketIds, updateConfig) {
    const domain = await HaloAuth.getDomain();
    const results = [];

    console.log('[HaloHelper] BulkUpdateTicketPlanDate called', { ticketIds, updateConfig, domain });

    for (const ticketId of ticketIds) {
        try {
            let newDateStr;

            if (typeof updateConfig.relativeDays === 'number') {
                // Relative shift: GET the ticket to read the current Plandatum value
                const getResponse = await HaloAuth.makeAuthenticatedRequest(
                    `https://${domain}/api/tickets/${ticketId}`,
                    { method: 'GET', redirect: 'follow' }
                );
                const ticket = await getResponse.json();

                let currentValue = null;
                if (ticket && Array.isArray(ticket.customfields)) {
                    for (const field of ticket.customfields) {
                        if (field && field.id === PLANDATUM_FIELD_ID) {
                            currentValue = field.value;
                            break;
                        }
                    }
                }

                if (!currentValue) {
                    throw new Error('Current Plandatum is empty — cannot apply relative shift');
                }

                const baseDate = new Date(currentValue);
                if (isNaN(baseDate.getTime())) {
                    throw new Error('Current Plandatum value is not a valid date');
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
                    customfields: [{ id: PLANDATUM_FIELD_ID, value: newDateStr }]
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
