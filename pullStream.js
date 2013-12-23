// Copyright (c) ComUnity 2013
// hansm@comunity.co.za (Hans Malherbe)
var Q = require('q');

var through = require('through');

function pullStream(is) {
    var deferred = Q.defer(), chunks = [];
    if (!is) {
        deferred.resolve(null);
        return deferred.promise;
    }
    is.on('error', function (err) {
        return deferred.reject(err);
    });
    if (is.resume && is['paused']) {
        is['paused'] = false;
        is.resume();
    }
    is.pipe(through(function write(data) {
        chunks.push(typeof data === 'string' ? new Buffer(data) : data);
    }, function end() {
        deferred.resolve(Buffer.concat(chunks));
    }));
    return deferred.promise;
}

module.exports = pullStream;
