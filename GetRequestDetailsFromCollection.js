const axios = require('axios');
var _ = require('lodash');

async function compareEndpoints(oldUrl, newUrl, collectionId, requestId, apiKey, sortArrays) {
    if (requestId != null) {
        const requestDetails = await getRequestDetails(collectionId, requestId, apiKey);
        if (!requestDetails) {
            console.log('Failed to retrieve request details.');
            return false;
        }

        compareResponses(oldUrl.replace("localhost", "host.docker.internal"), newUrl.replace("localhost", "host.docker.internal"), requestDetails, sortArrays);
    } else {
        console.log("No request id provided, comparing all requests in collection");
        const requestDetails = await getCollectionDetails(collectionId, apiKey);
        if (!requestDetails) {
            console.log('Failed to retrieve request details.');
            return false;
        }
        for (const request of requestDetails) {
            console.log("Comparing request: " + request.name);
            await compareResponses(oldUrl.replace("localhost", "host.docker.internal") + request.path, newUrl.replace("localhost", "host.docker.internal") + request.path, request, sortArrays);
            console.log("---------------------------------------------------");
        }
    }
}

async function getCollectionDetails(collectionId, apiKey) {
    try {
        const response = await axios.get(`https://api.postman.com/collections/${collectionId}?access_key=${apiKey}`);

        const collection = response.data.collection;

        if (!collection) {
            console.error(`Collection with ID ${collectionId} not found.`);
            return null;
        }

        // Extract request details
        return collection.item.map(mapPostmanRequestToRequestDetails)
    } catch (error) {
        console.error(`Error fetching details from collection ${collectionId}: ${error.message}`);
        return null;
    }
}

async function getRequestDetails(collectionId, requestId, apiKey) {
    try {
        const response = await axios.get(`https://api.postman.com/collections/${collectionId}?access_key=${apiKey}`);

        const collection = response.data.collection;

        // Find the request by requestId
        const request = collection.item.find(item => item.id === requestId);

        if (!request) {
            console.error(`Request with ID ${requestId} not found in the collection ${collectionId}.`);
            return null;
        }

        // Extract request details
        return mapPostmanRequestToRequestDetails(request);
    } catch (error) {
        console.error(`Error fetching request details for request ${requestId} from collection ${collectionId}: ${error.message}`);
        return null;
    }
}

function mapPostmanRequestToRequestDetails(request) {
    return new RequestDetails(
        request.name,
        request.request.method,
        getFromKeyValueArrayToMap(request.request.header ? request.request.header : []),
        getFromKeyValueArrayToMap(request.request.url.query ? request.request.url.query : []),
        '/' + request.request.url.path.join('/'),
        request.request.body ? request.request.body.raw : null);
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
    constructor(name, method, headers, queryParams, path, body) {
        this.name = name;
        this._method = method;
        this._headers = headers;
        this._queryParams = queryParams;
        this._body = body;
        this._path = path;
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

    get path() {
        return this._path;
    }
}

async function compareResponses(oldUrl, newUrl, requestDetails, sortArrays) {
    try {
        let configOld = {
            url: oldUrl,
            headers: requestDetails.headers,
            params: requestDetails.queryParams,
            validateStatus: function (status) {
                return true; // default
            },
            data: requestDetails.body,
            method: requestDetails.method.toUpperCase()
        }
        let configNew = {
            url: newUrl,
            headers: requestDetails.headers,
            params: requestDetails.queryParams,
            validateStatus: function (status) {
                return true; // default
            },
            data: requestDetails.body,
            method: requestDetails.method.toUpperCase()
        }
        if (process.env.EXTENDED_LOGS) {
            console.log("Sending request to old: " + JSON.stringify(configOld));
            console.log("Sending request to new: " + JSON.stringify(configNew));
        }


        let newResponse = await axios(configNew);
        let oldResponse = await axios(configOld);

        if (process.env.EXTENDED_LOGS) {
            console.log(`Received response from old: \n status: ${oldResponse.status}, \n body: ${JSON.stringify(oldResponse.data)}`);
            console.log(`Received response from new: \n status: ${newResponse.status}, \n body: ${JSON.stringify(newResponse.data)}`);
        }
        if (!oldResponse || !newResponse) {
            console.log('Error retrieving responses');
            return false;
        }

        // Compare status codes
        if (oldResponse.status !== newResponse.status) {
            console.log(`Status codes differ for endpoint: Old - ${oldResponse.status}, New - ${newResponse.status}`);
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


const collectionId = process.env.COLLECTION_ID;
const requestId = process.env.REQUEST_ID;
const apiKey = process.env.API_KEY;
const oldUrl = process.env.OLD_URL;
const newUrl = process.env.NEW_URL;
const sortArrays = process.env.SORT_ARRAYS;

let requiredParamsPresent = true;
if (!collectionId) {
    console.log('COLLECTION_ID is required. (Get from Info page of collection in Postman)');
    requiredParamsPresent = false;
}
if (!apiKey) {
    console.log('API_KEY is required. (Get from Share option in postman)');
    requiredParamsPresent = false;
}
if (!oldUrl) {
    console.log('OLD_URL is required.');
    requiredParamsPresent = false;
}
if (!newUrl) {
    console.log('NEW_URL is required.');
    requiredParamsPresent = false;
}
if (requiredParamsPresent) {
    compareEndpoints(oldUrl, newUrl, collectionId, requestId, apiKey, sortArrays);
}