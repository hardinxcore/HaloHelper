async function showTicketHistory() {
    const localStorage = await chrome.storage.local.get();

    // Check the options to make sure the domain has been set
    if ((localStorage.haloDomain == null || localStorage.haloDomain == '') || (localStorage.haloTicketHistory == null))
        return;

    function extractKlantId(ticket) {
        if (!ticket) return '-';

        // Primary source: explicit custom field name
        if (ticket.customfields && Array.isArray(ticket.customfields)) {
            for (const field of ticket.customfields) {
                if (!field) continue;

                const fieldName = (field.name || field.fieldname || field.label || field.id || '').toString().toLowerCase();
                if (fieldName === 'cfcustomerexternalreference') {
                    const value = (field.value || '').toString().trim();
                    if (value && value !== '0') return value;
                }
            }
        }

        // Fallbacks for tenants where the field is exposed differently
        if (ticket.CFCustomerExternalReference) {
            const directValue = ticket.CFCustomerExternalReference.toString().trim();
            if (directValue && directValue !== '0') return directValue;
        }

        return '-';
    }

    localStorage.haloTicketHistory.forEach(ticket => {
        let link = document.createElement('a');
        link.setAttribute('target', '_blank');
        link.setAttribute('href', 'https://' + localStorage.haloDomain + '/ticket?id=' + ticket.id);
        // Format: TICKETID // KLANTID // ORGANIZATION NAME // TICKET TITLE
        const klantId = extractKlantId(ticket);
        link.innerText = ticket.id + ' // ' + klantId + ' // ' + ticket.client_name + ' // ' + ticket.summary;

        let ticketsDiv = document.querySelector('#TicketsDiv');
        ticketsDiv.appendChild(link);

        ticketsDiv.appendChild(document.createElement('br'));
    });
}

document.body.onload = showTicketHistory;