// Copyright (c) ComUnity 2013
// hansm@comunity.co.za (Hans Malherbe)

///<reference path="../typed/node/node.d.ts" />

import stream = require('stream')

var from = require('from')

function memoryStream(buffer: NodeBuffer): stream.ReadableStream {
    var is = from(function getChunk(count, next) {
        if (buffer)
            this.emit('data', buffer)
		this.emit('end')
	})
    return is
}

export = memoryStream