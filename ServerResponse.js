// Copyright (c) ComUnity 2013
// hansm@comunity.co.za (Hans Malherbe)
var p = require('promisefy');

var ServerResponse = (function () {
    function ServerResponse(_res) {
        this._res = _res;
    }
    ServerResponse.prototype.writeHead = function (statusCode, reasonPhrase, headers) {
        this._res.writeHead(statusCode, reasonPhrase, headers);
    };
    ServerResponse.prototype.setHeader = function (name, value) {
        this._res.setHeader(name, value);
    };
    ServerResponse.prototype.end = function (data, encoding) {
        this._res.end(data, encoding);
    };
    ServerResponse.prototype.pipefrom = function (source) {
        p.pipe(source, this._res);
    };
    return ServerResponse;
})();

module.exports = ServerResponse;
