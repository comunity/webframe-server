// Copyright (c) ComUnity 2013
// Hans Malherbe <hansm@comunity.co.za>
///<reference path="../../typed/node/node.d.ts" />
var assert = require('assert');
var httpCacheDirectives = require('../httpCacheDirectives');
var HttpHeader = require('../HttpHeader');

function run() {
    console.log('parseHttpHeader   #########################################');

    cacheControl();
    httpHeader();

    console.log('parseHttpHeader   -----------------------------------------');
}


function httpHeader() {
    console.log(' httpHeader');
    var header = HttpHeader.parse('multipart/form-data; boundary=----WebKitFormBoundary8X9d7PuvjCKZpBVb');

    assert(header.part('multipart/form-data'));
    assert(!header.part('boundary'));
    assert.equal(header.part('multipart/form-data').option('boundary'), '----WebKitFormBoundary8X9d7PuvjCKZpBVb');

    header = HttpHeader.parse('en-GB,en;q=0.8,en-US;q=0.6,af;q=0.4');
    assert(header.part('en-GB'));
    assert(header.part('en'));
    assert(header.part('en-US'));
    assert(header.part('af'));
    assert(!header.part('af-ZA'));
    assert.equal(header.part('en').option('q'), '0.8');

    assert(!HttpHeader.parse(null));
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
