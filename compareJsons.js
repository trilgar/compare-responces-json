var diff = require('deep-diff').diff;

var lhs = {
    name: 'my object',
    description: 'it\'s an object!',
    details: {
        it: 'has',
        an: 'array',
        with: ['a', 'few', 'elements']
    }
};

var rhs = {
    details: {
        it: 'has',
        an: 'array',
        with: ['more','a', 'few','elements', { than: 'before' }]
    },
    name: 'updated object',
    description: 'it\'s an object!'

};

console.log('Difference2', diff(lhs, rhs))