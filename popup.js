async function showTicketHistory() {
    const localStorage = await chrome.storage.local.get();

    // Check the options to make sure the domain has been set
    if ((localStorage.haloDomain == null || localStorage.haloDomain == '') || (localStorage.haloTicketHistory == null))
        return;

    localStorage.haloTicketHistory.forEach(ticket => {
        let link = document.createElement('a');
        link.setAttribute('target', '_blank');
        link.setAttribute('href', 'https://' + localStorage.haloDomain + '/ticket?id=' + ticket.id);
        // New format: TICKETID // ORGANIZATION NAME // TICKET TITLE
        link.innerText = ticket.id + ' // ' + ticket.client_name + ' // ' + ticket.summary;

        let ticketsDiv = document.querySelector('#TicketsDiv');
        ticketsDiv.appendChild(link);

        ticketsDiv.appendChild(document.createElement('br'));
    });
}

document.body.onload = showTicketHistory;