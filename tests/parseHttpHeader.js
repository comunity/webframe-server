// Copyright (c) ComUnity 2013
// Hans Malherbe <hansm@comunity.co.za>
///<reference path="../../typed/node/node.d.ts" />
var assert = require('assert');
var httpCacheDirectives = require('../httpCacheDirectives');

function run() {
    console.log('parseHttpHeader   #########################################');

    cacheControl();

    console.log('parseHttpHeader   -----------------------------------------');
}


function cacheControl() {
    console.log(' cacheControl');

    assert.strictEqual(httpCacheDirectives('max-age=0')['max-age'], '0');
    assert.strictEqual(httpCacheDirectives('max-age=123')['max-age'], '123');
    assert.strictEqual(httpCacheDirectives('max-age=123')['no-cache'], void 0);
    assert.strictEqual(httpCacheDirectives('max-age=123,no-cache')['no-cache'], true);
    assert.strictEqual(httpCacheDirectives('no-cache,max-age=123')['no-cache'], true);
}
module.exports = run;
