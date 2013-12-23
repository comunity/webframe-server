// Copyright (c) ComUnity 2013
// hansm@comunity.co.za (Hans Malherbe)
var from = require('from');

function memoryStream(buffer) {
    var is = from(function getChunk(count, next) {
        if (buffer)
            this.emit('data', buffer);
        this.emit('end');
    });
    return is;
}

module.exports = memoryStream;
