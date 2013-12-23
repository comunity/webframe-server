// Copyright (c) ComUnity 2013
// hansm@comunity.co.za (Hans Malherbe)

///<reference path="../../typed/node/node.d.ts" />
///<reference path="../../typed/q/Q.d.ts" />

import stream = require('stream')
import Q = require('q')

var through = require('through')

function pullStream(is: stream.ReadableStream): Q.Promise<NodeBuffer> {
    var deferred: Q.Deferred<NodeBuffer> = Q.defer<NodeBuffer>()
        , chunks = []
    if (!is) {
        deferred.resolve(null)
        return deferred.promise
    }
    is.on('error', err => deferred.reject(err))
    if (is.resume && is['paused']) {
    	is['paused'] = false
        is.resume()
    }
    is.pipe(through(function write(data) {
        chunks.push(typeof data === 'string' ? new Buffer(data) : data)
    }, function end() {
        deferred.resolve(Buffer.concat(chunks))
    }))
    return deferred.promise
}

export = pullStream