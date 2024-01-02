const axios = require('axios');
var _ = require('lodash');

async function compareEndpoints(oldUrl, newUrl, collectionId, requestId, apiKey, sortArrays) {
    const requestDetails = await getRequestDetails(collectionId, requestId, apiKey);
    if (!requestDetails) {
        console.log('Failed to retrieve request details.');
        return false;
    }

    compareResponses(oldUrl.replace("localhost", "host.docker.internal"), newUrl.replace("localhost", "host.docker.internal"), requestDetails, sortArrays);
}

async function getRequestDetails(collectionId, requestId, apiKey) {
    try {
        const response = await axios.get(`https://api.postman.com/collections/${collectionId}?access_key=${apiKey}`);

        const collection = response.data.collection;

        // Find the request by requestId
        const request = collection.item.find(item => item.id === requestId);

        if (!request) {
            console.error(`Request with ID ${requestId} not found in the collection.`);
            return null;
        }

        // Extract request details
        return new RequestDetails(
            request.name,
            request.request.method,
            getFromKeyValueArrayToMap(request.request.header ? request.request.header : []),
            getFromKeyValueArrayToMap(request.request.url.query ? request.request.url.query : []),
            request.request.body ? request.request.body.raw : null);
    } catch (error) {
        console.error(`Error fetching request details: ${error.message}`);
        return null;
    }
}

function getFromKeyValueArrayToMap(keyValueArray) {
    if (!Array.isArray(keyValueArray)) {
        // If keyValueArray is not an array, you can handle it accordingly.
        // For now, let's return an empty object.
        return {};
    }
    return keyValueArray.reduce((result, param) => {
        result[param.key] = param.value;
        return result;
    }, {});
}

class RequestDetails {
    constructor(name, method, headers, queryParams, body) {
        this.name = name;
        this._method = method;
        this._headers = headers;
        this._queryParams = queryParams;
        this._body = body;
    }

    get method() {
        return this._method;
    }

    get headers() {
        return this._headers;
    }

    get queryParams() {
        return this._queryParams;
    }

    get body() {
        return this._body;
    }
}

async function compareResponses(oldUrl, newUrl, requestDetails, sortArrays) {
    try {
        let oldResponse = null;
        let newResponse = null;

        let config = {
            headers: requestDetails.headers,
            params: requestDetails.queryParams,
        }
        let payload = requestDetails.body;
        let method = requestDetails.method;

        // axios.interceptors.request.use(request => {
        //     console.log('Starting Request', JSON.stringify(request, null, 2))
        // })

        if (method === 'GET') {
            newResponse = await axios.get(newUrl, config);
            oldResponse = await axios.get(oldUrl, config);
        } else if (method === 'POST') {
            oldResponse = await axios.post(oldUrl, payload, config);
            newResponse = await axios.post(newUrl, payload, config);
        } else if (method === 'PUT') {
            oldResponse = await axios.put(oldUrl, payload, config);
            newResponse = await axios.put(newUrl, payload, config);
        } else if (method === 'DELETE') {
            oldResponse = await axios.delete(oldUrl, config);
            newResponse = await axios.delete(newUrl, config);
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
            console.log(`Status codes differ for endpoint: Old - ${oldResponse.status}, New - ${newResponse.status}`);
            return false;
        }
        let difference = deepDiff(oldResponse.data, newResponse.data, sortArrays);

        console.log('Difference between responses: ', difference);

        return true;
    } catch (error) {
        console.error(`Error comparing responses: ${error.message}`);
        return false;
    }
}

/**
 * Deep diff between two object-likes
 * @param  {Object} fromObject the original object
 * @param  {Object} toObject   the updated object
 * @param {string} sortArrays whether to sort arrays before comparing
 * @return {Object}            a new object which represents the diff
 */
function deepDiff(fromObject, toObject, sortArrays = "false") {
    const changes = {};

    const buildPath = (path, obj, key) =>
        _.isUndefined(path) ? key : `${path}.${key}`;

    const walk = (fromObject, toObject, path) => {
        for (const key of _.keys(fromObject)) {
            const currentPath = buildPath(path, fromObject, key);
            if (!_.has(toObject, key)) {
                changes[currentPath] = {from: _.get(fromObject, key)};
            }
        }
        if (sortArrays === 'true' && _.isArray(toObject) && _.isArray(fromObject)) {
            fromObject = sortArrayByJSONString(fromObject)
            toObject = sortArrayByJSONString(toObject)
        }

        for (let [key, to] of _.entries(toObject)) {
            const currentPath = buildPath(path, toObject, key);
            if (!_.has(fromObject, key)) {
                changes[currentPath] = {to};
            } else {
                let from = _.get(fromObject, key);
                if (!_.isEqual(from, to)) {
                    if (_.isObjectLike(to) && _.isObjectLike(from)) {
                        walk(from, to, currentPath);
                    } else {
                        changes[currentPath] = {from, to};
                    }
                }
            }
        }
    };

    walk(fromObject, toObject);

    return changes;
}

function sortArrayByJSONString(arr) {
    const sortedArray = [...arr]; // Create a copy to avoid modifying the original array
    sortedArray.sort((a, b) => {
        const hashA = JSON.stringify(a);
        const hashB = JSON.stringify(b);
        return hashA.localeCompare(hashB);
    });
    return sortedArray;
}

// Example usage
// const collectionId = '13494300-16d6d8f3-a526-44bc-8f80-cb5e9c973dd9';
// const requestId = '7fef763c-95b8-418c-b814-6b687bdb3d05';
// const apiKey = 'PMAT-01HJTWNR860JAVYFQHWHA4E6VJ';
// const oldUrl = 'https://2c9718e8-3c0d-421a-ac78-97bf5786c9b9.mock.pstmn.io/NMS/resource';
// const newUrl = 'http://localhost:8080/NMS/resource';

const collectionId = process.env.COLLECTION_ID;
const requestId = process.env.REQUEST_ID;
const apiKey = process.env.API_KEY;
const oldUrl = process.env.OLD_URL;
const newUrl = process.env.NEW_URL;
const sortArrays = process.env.SORT_ARRAYS;

compareEndpoints(oldUrl, newUrl, collectionId, requestId, apiKey, sortArrays);