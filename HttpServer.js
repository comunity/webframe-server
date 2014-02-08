// Copyright (c) ComUnity 2013
// hansm@comunity.co.za (Hans Malherbe)
///<reference path="../typed/node/node.d.ts" />
///<reference path="../typed/q/Q.d.ts" />
///<reference path="./node_modules/webframe-base/index.d.ts" />
///<reference path="./node_modules/promisefy/index.d.ts" />
var wfbase = require('webframe-base');

var http = require('http');
var httpCacheDirectives = require('./httpCacheDirectives');
var HttpHeader = require('./HttpHeader');
var p = require('promisefy');
var Q = require('q');
var ServerResponse = require('./ServerResponse');

var StreamMesg = require('./StreamMesg');
var url = require('url');

var formidable = require('formidable');

var HttpServer = (function () {
    function HttpServer(port, authn, errorLog) {
        this.handlers = [];
        this.server = http.createServer(setupRequestListener(this.handlers, authn, errorLog));
        this.server.listen(port);
    }
    HttpServer.prototype.close = function () {
        this.server.close();
        this.server = null;
    };
    HttpServer.prototype.add = function (handler) {
        this.handlers.push(handler);
    };
    return HttpServer;
})();


var Responder = (function () {
    function Responder(_res) {
        this._res = _res;
    }
    Responder.prototype.writeHead = function (statusCode, reasonPhrase, headers) {
        this._res.writeHead(statusCode, reasonPhrase, headers);
    };
    Responder.prototype.setHeader = function (name, value) {
        this._res.setHeader(name, value);
    };
    Responder.prototype.end = function (data, encoding) {
        var _this = this;
        return Q.fcall(function () {
            _this._res.end(data, encoding);
            return null;
        });
    };
    Responder.prototype.pipefrom = function (source) {
        return p.pipe(source, this._res).then(function (hrtime) {
            return null;
        });
    };
    return Responder;
})();

function setupRequestListener(handlers, authn, errorLog) {
    return function (req, res) {
        var reqId = errorLog.id();
        var start = process.hrtime();
        var authHeader = req.headers['authorization'];
        res.on('close', function () {
            return errorLog.log('error', reqId, { method: req.method, url: req.url, err: new Error('Connection closed'), start: start, headers: addCors(wfbase.privatiseHeaders(req.headers)) });
        });
        res.on('finish', function () {
            return errorLog.log('in', reqId, { method: req.method, url: req.url, statusCode: res.statusCode, start: start, headers: wfbase.privatiseHeaders(req.headers) });
        });
        if (!authHeader)
            return handle(req, res, null, reqId, start);
        check(authHeader, reqId).then(function (up) {
            if (up)
                handle(req, res, up, reqId, start);
            else
                mustAuthenticate(res);
        }).fail(function (err) {
            mustAuthenticate(res);
        });
    };
    function mustAuthenticate(res) {
        res.writeHead(401, addCors({ 'WWW-Authenticate': 'Basic realm="CU"' }));
        res.end();
    }
    function check(authHeader, reqId) {
        var token = authHeader.split(/\s+/).pop() || '';
        var auth = new Buffer(token, 'base64').toString();
        var parts = auth.split(/:/);
        var user = parts[0];
        var password = parts[1];
        if (!authn)
            return Q.fcall(function () {
                return wfbase.UserProfile.make(user, password);
            });
        return authn.check(user, password, reqId).then(function (valid) {
            return valid ? wfbase.UserProfile.make(user, password) : null;
        });
    }
    function handle(req, res, up, reqId, start) {
        try  {
            var incoming = getResponse(handlers, req, up, reqId);
            if (!incoming) {
                res.writeHead(404, addCors({}));
                return res.end();
            }
            incoming.then(function (m) {
                var responder = new Responder(res);
                m.setHeaders(new ServerResponse(res));
                return m.respond(responder);
            }).done(null, function (err) {
                return handleError(err);
            });
        } catch (err) {
            handleError(err);
        }

        return;

        function handleError(err) {
            errorLog.log('error', reqId, { method: req.method, url: req.url, err: err, stack: err.stack, start: start, up: up, headers: wfbase.privatiseHeaders(req.headers) });
            if (err.detail && err.detail.statusCode && err.detail.statusCode !== 304) {
                res.writeHead(err.detail.statusCode, addCors({ 'Content-Type': 'application/json' }));
                return res.end(JSON.stringify(err.detail));
            }
            if (err.statusCode) {
                res.writeHead(err.statusCode, err.toString());
                return res.end();
            }
            res.writeHead(500, addCors({}));
            res.end();
        }
    }
}

function addCors(headers) {
    headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,PATCH';
    headers['Access-Control-Allow-Origin'] = '*';
    headers['Access-Control-Allow-Headers'] = 'Authorization,Content-Type';
    return headers;
}

function getMaxAge(headers) {
    var cacheControl = httpCacheDirectives(headers['cache-control']);
    if (!cacheControl)
        return -1;
    var maxAge = cacheControl['max-age'];
    if (maxAge === void 0)
        return -1;
    return maxAge === void 0 ? -1 : parseInt(maxAge, 10);
}

function getResponse(handlers, req, up, reqId) {
    var uri = url.parse('http://' + req.headers['host'] + req.url);
    if (req.method === 'GET')
        return read(handlers, uri, up, reqId, getMaxAge(req.headers), req.headers['accept'], req.headers['if-none-match'], req.headers['if-modified-since']);
    if (req.method === 'DELETE')
        return remove(handlers, uri, up, reqId);
    if (req.method == 'PUT')
        return replace(handlers, uri, up, reqId, getMessage(req));
    if (req.method == 'PATCH')
        return update(handlers, uri, up, reqId, getMessage(req), req.headers['accept']);
    if (req.method == 'POST')
        return exec(handlers, uri, up, reqId, getMessage(req), req.headers['accept'], req);
    return Q.fcall(function () {
        return req.method === 'OPTIONS' ? new wfbase.BaseMsg(200, addCors({})) : new wfbase.BaseMsg(405, null);
    });
}

function getMessage(req) {
    return new StreamMesg(0, req.headers, req);
}

function read(handlers, uri, up, reqId, maxAge, accept, ifNoneMatch, ifModifiedSince) {
    var i = 0, res, handler;
    for (; i < handlers.length; ++i) {
        handler = handlers[i];
        if (!handler.identified(uri))
            continue;
        if (!handler.acceptable(accept))
            return Q.fcall(function () {
                return new wfbase.BaseMsg(406);
            });
        return ifNoneMatch || ifModifiedSince ? handler.readConditional(uri, up, reqId, maxAge, accept, ifNoneMatch, ifModifiedSince) : handler.read(uri, up, reqId, maxAge, accept);
    }
    return null;
}

function remove(handlers, uri, up, reqId) {
    var i = 0, res, handler;
    for (; i < handlers.length; ++i) {
        handler = handlers[i];
        if (!handler.identified(uri))
            continue;

        return handler.remove(uri, up, reqId);
    }
    return null;
}

function replace(handlers, uri, up, reqId, message) {
    var i = 0, res, handler;
    for (; i < handlers.length; ++i) {
        handler = handlers[i];
        if (!handler.identified(uri))
            continue;

        return handler.replace(uri, up, reqId, message);
    }
    return null;
}

function update(handlers, uri, up, reqId, message, accept) {
    var i = 0, res, handler;
    for (; i < handlers.length; ++i) {
        handler = handlers[i];
        if (!handler.identified(uri))
            continue;
        if (!handler.acceptable(accept))
            return Q.fcall(function () {
                return new wfbase.BaseMsg(406);
            });

        return handler.acceptable(accept) && handlers[i].update(uri, up, reqId, message, accept);
    }
    return null;
}

function exec(handlers, uri, up, reqId, message, accept, req) {
    var i = 0, res, handler;
    for (; i < handlers.length; ++i) {
        handler = handlers[i];
        if (!handler.identified(uri))
            continue;
        if (!handler.acceptable(accept))
            return Q.fcall(function () {
                return new wfbase.BaseMsg(406);
            });

        if (!handler.acceptable(accept))
            return null;
        if (!hasMultipartContentType(req.headers['content-type']))
            return handlers[i].exec(uri, up, reqId, message, accept);
        return parseForm(req).then(function (incomingMsg) {
            return handlers[i].exec(uri, up, reqId, incomingMsg, accept);
        });
    }
    return null;
}

function hasMultipartContentType(contentType) {
    var header = HttpHeader.parse(contentType);
    return header && header.part('multipart/form-data');
}

function parseForm(req) {
    var defer = Q.defer();
    var form = new formidable.IncomingForm();
    form.hash = 'sha1';

    form.parse(req, function (err, fields, files) {
        if (err)
            return defer.reject(err);
        var o = {};
        Object.keys(fields).forEach(function (key) {
            return o[key] = fields[key];
        });
        Object.keys(files).forEach(function (key) {
            return o[key] = files[key];
        });
        defer.resolve(new wfbase.ObjectMsg(0, req.headers, o));
    });
    return defer.promise;
}
module.exports = HttpServer;
