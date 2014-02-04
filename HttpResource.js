// Copyright (c) ComUnity 2013
// hansm@comunity.co.za (Hans Malherbe)
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
///<reference path="../typed/node/node.d.ts" />
///<reference path="../typed/q/Q.d.ts" />
///<reference path="./node_modules/webframe-base/index.d.ts" />
///<reference path="./node_modules/promisefy/index.d.ts" />
var wfbase = require('webframe-base');

var memoryStream = require('./memoryStream');

var Q = require('q');

var StreamMsg = require('./StreamMsg');

var hyperquest = require('hyperquest'), through = require('through');

var HttpResource = (function (_super) {
    __extends(HttpResource, _super);
    function HttpResource(_url, _logger, _dontthrow) {
        _super.call(this);
        this._url = _url;
        this._logger = _logger;
        this._dontthrow = _dontthrow;
    }
    HttpResource.prototype.read = function (track, accept) {
        var responder = new Responder('GET', this._url, track, this._logger, this._dontthrow, accept);
        new wfbase.BaseMsg(0).respond(responder);
        return responder.msg();
    };
    HttpResource.prototype.exec = function (track, message, accept) {
        var responder = new Responder('POST', this._url, track, this._logger, this._dontthrow, accept);
        message.respond(responder);
        return responder.msg();
    };
    HttpResource.prototype.replace = function (track, message, accept) {
        var responder = new Responder('PUT', this._url, track, this._logger, this._dontthrow, accept);
        message.respond(responder);
        return responder.msg();
    };
    HttpResource.prototype.remove = function (track, accept) {
        var responder = new Responder('DELETE', this._url, track, this._logger, this._dontthrow, accept);
        new wfbase.BaseMsg(0).respond(responder);
        return responder.msg();
    };
    return HttpResource;
})(wfbase.Resource);


var HttpResponse = (function () {
    function HttpResponse(url, res) {
        this.url = url;
        this.res = res;
    }
    return HttpResponse;
})();

var Responder = (function () {
    function Responder(_method, _url, _track, _logger, _dontthrow, _accept) {
        this._method = _method;
        this._url = _url;
        this._track = _track;
        this._logger = _logger;
        this._dontthrow = _dontthrow;
        this._accept = _accept;
        this.statusCode = 0;
        this.headers = {};
        if (this._accept)
            this.headers.accept = this._accept;
    }
    Responder.prototype.msg = function () {
        return this._msg;
    };
    Responder.prototype.writeHead = function (statusCode, reasonPhrase, headers) {
        this.statusCode = statusCode;
        if (reasonPhrase)
            this.reasonPhrase = reasonPhrase;
        if (headers)
            this.headers = headers;
    };
    Responder.prototype.setHeader = function (name, value) {
        this.headers[name] = value;
    };
    Responder.prototype.end = function (data, encoding) {
        this._msg = data ? request(this._method, this._url, this.headers, this._track, this._logger, this._dontthrow, memoryStream(data)) : request(this._method, this._url, this.headers, this._track, this._logger, this._dontthrow);
    };
    Responder.prototype.pipefrom = function (source) {
        this._msg = request(this._method, this._url, this.headers, this._track, this._logger, this._dontthrow, source);
    };
    return Responder;
})();

function request(m, u, headers, track, logger, dontthrow, is) {
    var start = process.hrtime();
    var deferred = Q.defer(), retries = 0;
    go(m, u);
    return deferred.promise;
    function go(method, url) {
        var formdata = [];
        ++retries;
        var os = hyperquest(url, {
            method: method,
            headers: headers
        }, function (err, response) {
            if (err) {
                logger.log('outError', track, {
                    method: method,
                    url: url,
                    start: start,
                    err: err
                });
                return deferred.reject(wfbase.statusError(500, function () {
                    return err;
                }, method, url));
            }
            var location = response.headers['location'], code = response.statusCode;
            if (retries < 5 && location && (code === 301 || code === 302 || code === 303)) {
                logger.log('redirect', track, {
                    method: method,
                    url: url,
                    statusCode: code,
                    start: start,
                    headers: wfbase.privatiseHeaders(headers),
                    retries: retries,
                    location: location
                });
                return go('GET', location);
            } else {
                logger.log('out', track, {
                    method: method,
                    url: url,
                    statusCode: code,
                    start: start,
                    headers: wfbase.privatiseHeaders(headers),
                    formdata: formdata ? Buffer.concat(formdata).toString() : null
                });
            }
            if (!dontthrow && (code < 200 || code >= 300))
                return deferred.reject(new wfbase.Status(code, method, url, response.headers).error(function (err) {
                    return new Error(err);
                }));
            if (response.pause) {
                response.pause();
                response['paused'] = true;
            }
            return deferred.resolve(new StreamMsg(code, response.headers, response));
        });
        if (is && method !== 'GET' && method !== 'DELETE') {
            is.on('error', function (err) {
                return deferred.reject(wfbase.statusError(500, function () {
                    return new Error(err);
                }, method, url));
            });
            if (is.resume && is['paused']) {
                is['paused'] = false;
                is.resume();
            }
            is.pipe(through(function write(data) {
                this.queue(data);
                formdata.push(data);
            }, function end() {
                this.queue(null);
            })).pipe(os);
        }
    }
}
module.exports = HttpResource;
