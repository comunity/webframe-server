// Copyright (c) ComUnity 2013
// hansm@comunity.co.za (Hans Malherbe)

///<reference path="../typed/node/node.d.ts" />
///<reference path="../typed/q/Q.d.ts" />
///<reference path="./node_modules/webframe-base/index.d.ts" />
///<reference path="./node_modules/promisefy/index.d.ts" />

import wfbase = require('webframe-base')

import http = require('http')
import httpCacheDirectives = require('./httpCacheDirectives')
import HttpHeader = require('./HttpHeader')
import p = require('promisefy')
import Q = require('q')
import ServerResponse = require('./ServerResponse')
import stream = require('stream')
import StreamMesg = require('./StreamMesg')
import url = require('url')
import utl = require('util')

var formidable = require('formidable')

class HttpServer {
    server: http.Server
    handlers: wfbase.Handler[]
    constructor(port: number, authn: wfbase.Authenticate, errorLog: wfbase.Logger) {
        this.handlers = []
        this.server = http.createServer(setupRequestListener(this.handlers, authn, errorLog))
        this.server.listen(port)
    }
    close() {
        this.server.close()
        this.server = null
    }
    add(handler: wfbase.Handler) {
        this.handlers.push(handler)
    }
}

export = HttpServer

class Responder implements wfbase.Response {
    constructor(private _res: http.ServerResponse) { }
    writeHead(statusCode: number, reasonPhrase?: string, headers?: any): void {
        this._res.writeHead(statusCode, reasonPhrase, headers)
    }
    setHeader(name: string, value: string): void {
        this._res.setHeader(name, value)
    }
    end(data?: any, encoding?: string): Q.Promise<wfbase.Msg> {
        return Q.fcall(() => {
            this._res.end(data, encoding)
            return null
        })
    }
    pipefrom<T extends stream.Readable>(source: T): Q.Promise<wfbase.Msg> {
        return p.pipe(source, <any>this._res).then(hrtime => null)
    }
}

var methodOverrides = {
    'PATCH': true,
    'POST': true,
    'GET': true,
    'PUT': true,
    'DELETE': true
}

function setupRequestListener(handlers: wfbase.Handler[], authn: wfbase.Authenticate, errorLog: wfbase.Logger) {
    return (req: http.ServerRequest, res: http.ServerResponse) => {
        if (req.headers.mo && methodOverrides[req.headers.mo])
            req.method = req.headers.mo

        var reqId = errorLog.id()
        var start = process.hrtime()
        var up = userProfile(req.headers['authorization'])
        res.on('close', () => errorLog.log('in', reqId, start, req.method, req.url, 500, up && up.login, wfbase.privatiseHeaders(req.headers), 'Connection closed'))
        res.on('finish', () => errorLog.log('in', reqId, start, req.method, req.url, res.statusCode, up && up.login, wfbase.privatiseHeaders(req.headers)))
        if (!up) 
            return handle(req, res, null, reqId, start)
        check(up, req, reqId).then(valid => {
            if (valid)
                handle(req, res, up, reqId, start)
            else
                mustAuthenticate(res)
        }).fail(err => {
            mustAuthenticate(res)
        })
    }
    function mustAuthenticate(res: http.ServerResponse): void {
        res.writeHead(403, addCors({ 'WWW-Authenticate': 'Basic realm="CU"' }))
        res.end()
    }
    function userProfile(authHeader: string): wfbase.UserProfile {
        if (!authHeader)
            return
        var token = authHeader.split(/\s+/).pop() || ''
        var auth = new Buffer(token, 'base64').toString()
        var parts = auth.split(/:/)
        var user = parts[0]
        var password = parts[1]
        return wfbase.UserProfile.make(user, password)
    }
    function check(up: wfbase.UserProfile, req: http.ServerRequest, reqId: string): Q.Promise<any> {
        if (!authn)
            return Q.fcall(() => up)
        return authn.check(up.login, up.password, req, reqId)
    }
    function handle(req: http.ServerRequest, res: http.ServerResponse, up: wfbase.UserProfile, reqId: string, start: number[]) {
        try {
            var incoming = getResponse(handlers, req, up, reqId)
            if (!incoming) {
                    res.writeHead(404, addCors())
                return res.end()
            }
            incoming.then(m => {
                var responder = new Responder(res)
                m.setHeaders(new ServerResponse(res))
                return m.respond(responder)
            }).done(null, err => handleError(err))
        } catch (err) {
            handleError(err)
        }

        return

        function hasContent(statusCode: number): boolean {
            return statusCode !== 304 && statusCode !== 204
        }

        function handleError(err: any) {
            errorLog.log('error', reqId, start, req.method, req.url, (err.detail && err.detail.statusCode) || err.statusCode || 500, up && up.login, wfbase.privatiseHeaders(req.headers), err) 
            if (err.detail && err.detail.statusCode) {
                res.writeHead(err.detail.statusCode, addCors(hasContent(err.detail.statusCode) ? { 'Content-Type': 'application/json' } : {}))
                return res.end(hasContent(err.detail.statusCode) ? JSON.stringify(err.detail) : null)
            }
            if (err.statusCode) {
                res.writeHead(err.statusCode, err.toString(), addCors())
                return res.end()
            }
            res.writeHead(500, addCors())
            res.end()
        }
    }
}

function addCors(headers?) {
    if (!headers)
        headers = {}
    headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,PATCH,OPTIONS'
    headers['Access-Control-Allow-Origin'] = '*'
    headers['Access-Control-Allow-Headers'] = 'Authorization,Content-Type,Cache-Control,X-Requested-With,X-XSRF-TOKEN'
    return headers
}

function getMaxAge(headers: any): number {
    var cacheControl = httpCacheDirectives(headers['cache-control'])
    if (!cacheControl)
        return -1
    var maxAge = cacheControl['max-age']
    if (maxAge === void 0)
        return -1
    return maxAge === void 0 ? -1 : parseInt(maxAge, 10)
}

function getResponse(handlers: wfbase.Handler[], req: http.ServerRequest, up: wfbase.UserProfile, reqId: string): Q.Promise<wfbase.Msg> {
    var uri = url.parse('http://' + req.headers['host'] + req.url)
    if (req.method === 'GET')
        return read(handlers, uri, up, reqId, req.headers, getMaxAge(req.headers))
    if (req.method === 'DELETE')
        return remove(handlers, uri, up, reqId, req.headers)
    if (req.method == 'PUT')
        return replace(handlers, uri, up, reqId, getMessage(req), req)
    if (req.method == 'PATCH')
        return update(handlers, uri, up, reqId, getMessage(req), req)
    if (req.method == 'POST')
        return exec(handlers, uri, up, reqId, getMessage(req), req)
    return Q.fcall(() => req.method === 'OPTIONS' ? new wfbase.BaseMsg(200, addCors()) : new wfbase.BaseMsg(405, null))
}

function getMessage(req: http.ServerRequest): wfbase.Msg {
    return new StreamMesg(0, req.headers, <any>req)
}

function read(handlers: wfbase.Handler[], uri: url.Url, up: wfbase.UserProfile, reqId: string, headers, maxAge: number): Q.Promise<wfbase.Msg> {
    var i = 0
        , res: Q.Promise<wfbase.Msg>
        , handler: wfbase.Handler
    for (; i < handlers.length; ++i) {
        handler = handlers[i]
        if (!handler.identified(uri))
            continue
        if (!handler.acceptable(headers.accept))
            return Q.fcall(() => new wfbase.BaseMsg(406))
        var ifNoneMatch = headers['if-none-match']
        var ifModifiedSince = headers['if-modified-since']
        return (ifNoneMatch || ifModifiedSince ? handler.readConditional(uri, up, reqId, headers, maxAge) : handler.read(uri, up, reqId, headers, maxAge)).then(msg => {
            if (ifNoneMatch && ifNoneMatch === msg.headers.ETag)
                throw wfbase.statusError(304, () => new Error('Not Modified'))
            return msg
        })
    }
    return null
}

function remove(handlers: wfbase.Handler[], uri: url.Url, up: wfbase.UserProfile, reqId: string, headers): Q.Promise<wfbase.Msg> {
    var i = 0
        , res: Q.Promise<wfbase.Msg>
        , handler: wfbase.Handler
    for (; i < handlers.length; ++i) {
        handler = handlers[i]
        if (!handler.identified(uri))
            continue

        return handler.remove(uri, up, reqId, headers)
    }
    return null
}

function replace(handlers: wfbase.Handler[], uri: url.Url, up: wfbase.UserProfile, reqId: string, message: wfbase.Msg, req): Q.Promise<wfbase.Msg> {
    var i = 0
        , res: Q.Promise<wfbase.Msg>
        , handler: wfbase.Handler
    for (; i < handlers.length; ++i) {
        handler = handlers[i]
        if (!handler.identified(uri))
            continue
        if (!handler.acceptable(req.headers.accept))
            return Q.fcall(function () {
                return new wfbase.BaseMsg(406)
            })

        if (!isHtmlForm(req.headers['content-type']))
            return handler.replace(uri, up, reqId, req.headers, message)
        return parseForm(req).then(function (incomingMsg) {
            return handler.replace(uri, up, reqId, req.headers, incomingMsg)
        })
    }
    return null
}

function update(handlers: wfbase.Handler[], uri: url.Url, up: wfbase.UserProfile, reqId: string, message: wfbase.Msg, req): Q.Promise<wfbase.Msg> {
    var i = 0
        , res: Q.Promise<wfbase.Msg>
        , handler: wfbase.Handler
    for (; i < handlers.length; ++i) {
        handler = handlers[i]
        if (!handler.identified(uri))
            continue
        if (!handler.acceptable(req.headers.accept))
            return Q.fcall(() => new wfbase.BaseMsg(406))

        if (!isHtmlForm(req.headers['content-type']))
            return handler.update(uri, up, reqId, req.headers, message)
        return parseForm(req).then(function (incomingMsg) {
            return handler.update(uri, up, reqId, req.headers, incomingMsg)
        })
    }
    return null
}

function exec(handlers: wfbase.Handler[], uri: url.Url, up: wfbase.UserProfile, reqId: string, message: wfbase.Msg, req: http.ServerRequest): Q.Promise<wfbase.Msg> {
    var i = 0
        , res: Q.Promise<wfbase.Msg>
        , handler: wfbase.Handler
    for (; i < handlers.length; ++i) {
        handler = handlers[i]
        if (!handler.identified(uri))
            continue
        if (!handler.acceptable(req.headers.accept))
            return Q.fcall(() => new wfbase.BaseMsg(406))
        
        if (!isHtmlForm(req.headers['content-type']))
            return handler.exec(uri, up, reqId, req.headers, message)
        return parseForm(req).then(incomingMsg => handler.exec(uri, up, reqId, req.headers, incomingMsg))
    }
    return null
}

function isHtmlForm(contentType: string) {
    return contentType && (contentType.match(/urlencoded/i) || contentType.match(/multipart/i))
}

function parseForm(req: http.ServerRequest): Q.Promise<wfbase.Msg> {
    var defer = Q.defer<wfbase.Msg>()
    var form = new formidable.IncomingForm();
    form.hash = 'sha1'

    form.parse(req, function (err, fields, files) {
        if (err)
            return defer.reject(err)
        var o = {
        }
        Object.keys(fields).forEach(key => o[key] = fields[key])
        Object.keys(files).forEach(key => o[key] = files[key])
        defer.resolve(new wfbase.ObjectMsg(0, req.headers, o))
    });
    return defer.promise
}

