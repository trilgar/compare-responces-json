const axios = require('axios');
var diff = require('deep-diff').diff;

async function compareResponses(method, oldUrl, newUrl, endpoint, headers, payload) {
    try {
        let oldResponse = null;
        let newResponse = null;

        if (method === 'GET') {
            oldResponse = await axios.get(oldUrl + endpoint, {headers});
            newResponse = await axios.get(newUrl + endpoint, {headers});
        } else if (method === 'POST') {
            oldResponse = await axios.post(oldUrl + endpoint, payload, {headers});
            newResponse = await axios.post(newUrl + endpoint, payload, {headers});
        } else if (method === 'PUT') {
            oldResponse = await axios.put(oldUrl + endpoint, payload, {headers});
            newResponse = await axios.put(newUrl + endpoint, payload, {headers});
        } else if (method === 'DELETE') {
            oldResponse = await axios.delete(oldUrl + endpoint, {headers});
            newResponse = await axios.delete(newUrl + endpoint, {headers});
        } else {
            console.log('Invalid method');
            return false;
        }
        if (!oldResponse || !newResponse) {
            console.log('Error retrieving responses');
            return false;
        }

        // Compare status codes
        if (oldResponse.status !== newResponse.status) {
            console.log(`Status codes differ for endpoint ${endpoint}: Old - ${oldResponse.status}, New - ${newResponse.status}`);
            return false;
        }


        console.log('Difference between responses: ', diff(oldResponse.data, newResponse.data));

        // Compare response bodies
        if (oldResponse.data !== newResponse.data) {
            return false;
        }
        // Additional comparisons for headers, etc., if needed

        return true;
    } catch (error) {
        console.error(`Error comparing responses: ${error.message}`);
        return false;
    }
}

// Example usage
const method = 'GET';
const oldServiceUrl = "https://api.github.com/users/mralexgray";
const newServiceUrl = "https://api.github.com/users/trilgar";
const sampleEndpoint = "/repos";
const sampleHeaders = {'Content-Type': 'application/json'};
const samplePayload = {key: 'value'};

compareResponses(method, oldServiceUrl, newServiceUrl, sampleEndpoint, sampleHeaders, samplePayload)
    .then(result => {
        if (result) {
            console.log('Responses match!');
        } else {
            console.log('Responses differ.');
        }
    });
