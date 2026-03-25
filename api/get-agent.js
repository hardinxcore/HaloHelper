async function GetAgent(AgentId) {
    try {
        const domain = await HaloAuth.getDomain();
        const url = `https://${domain}/api/agent/${AgentId}`;
        
        const response = await HaloAuth.makeAuthenticatedRequest(url, {
            method: 'GET',
            redirect: 'follow'
        });
        
        const agent = await response.json();
        return agent;
    }
    catch (error) {
        console.error("Error in GetAgent:", error);
        throw error;
    }
}