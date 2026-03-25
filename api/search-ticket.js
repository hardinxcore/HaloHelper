async function SearchTicket(Parameters) {
    try {
        const domain = await HaloAuth.getDomain();
        
        let pageNo = 1;
        let tickets = [];
        let responseBody;
        
        do {
            let url = `https://${domain}/api/tickets`;
            url += '?pageinate=true';
            url += '&page_size=100'; // Max is 100
            url += `&page_no=${pageNo++}`;
            
            // Add optional parameters
            if (Parameters.dateSearch != null) url += `&datesearch=${Parameters.dateSearch}`;
            if (Parameters.startDate != null) url += `&startdate=${Parameters.startDate}`;
            if (Parameters.endDate != null) url += `&enddate=${Parameters.endDate}`;
            if (Parameters.statusId != null) url += `&status_id=${Parameters.statusId}`;
            if (Parameters.status != null) url += `&status=${Parameters.status}`;
            if (Parameters.requestTypeId != null) url += `&requesttype_id=${Parameters.requestTypeId}`;
            if (Parameters.requestType != null) url += `&requesttype=${Parameters.requestType}`;
            if (Parameters.clientId != null) url += `&client_id=${Parameters.clientId}`;
            if (Parameters.search != null) url += `&search=${Parameters.search}`;
            if (Parameters.searchactions != null) url += `&searchactions=${Parameters.searchactions}`;

            const response = await HaloAuth.makeAuthenticatedRequest(url, {
                method: 'GET',
                redirect: 'follow'
            });
            
            responseBody = await response.json();
            tickets = tickets.concat(responseBody.tickets);
        } while (responseBody.page_no * responseBody.page_size < responseBody.record_count);

        return tickets;
    }
    catch (error) {
        console.error("Error in SearchTicket:", error);
        throw error;
    }
}