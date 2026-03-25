async function GetTicket(TicketId) {
    try {
        const domain = await HaloAuth.getDomain();
        const url = `https://${domain}/api/tickets/${TicketId}`;
        
        const response = await HaloAuth.makeAuthenticatedRequest(url, {
            method: 'GET',
            redirect: 'follow'
        });
        
        const ticket = await response.json();
        return ticket;
    }
    catch (error) {
        console.error("Error in GetTicket:", error);
        throw error;
    }
}