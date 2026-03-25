async function SearchLookup(Parameters) {
    try {
        const domain = await HaloAuth.getDomain();
        
        let url = `https://${domain}/api/lookup`;
        if (Parameters.lookupId != null) {
            url += `?lookupid=${Parameters.lookupId}`;
        }

        const response = await HaloAuth.makeAuthenticatedRequest(url, {
            method: 'GET',
            redirect: 'follow'
        });
        
        const responseBody = await response.json();
        return responseBody;
    }
    catch (error) {
        console.error("Error in SearchLookup:", error);
        throw error;
    }
}