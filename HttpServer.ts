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
        var authHeader = req.headers['authorization']
        res.on('close', () => errorLog.log('error', reqId, { method: req.method, url: req.url, err: new Error('Connection closed'), start: start, headers: addCors(wfbase.privatiseHeaders(req.headers)) }))
        res.on('finish', () => errorLog.log('in', reqId, { method: req.method, url: req.url, statusCode: res.statusCode, start: start, headers: wfbase.privatiseHeaders(req.headers) }))
        if (!authHeader) 
            return handle(req, res, null, reqId, start)
        check(authHeader, reqId).then(up => {
            if (up)
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
    function check(authHeader: string, reqId: string): Q.Promise<wfbase.UserProfile> {
        var token = authHeader.split(/\s+/).pop() || ''
        var auth = new Buffer(token, 'base64').toString()
        var parts = auth.split(/:/)
        var user = parts[0]
        var password = parts[1]
        if (!authn)
            return Q.fcall(() => {
                return wfbase.UserProfile.make(user, password)
            })
        return authn.check(user, password, reqId).then(valid => valid ? wfbase.UserProfile.make(user, password) : null)
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
            errorLog.log('error', reqId, { method: req.method, url: req.url, err: err, stack: err.stack, start: start, up: up, headers: wfbase.privatiseHeaders(req.headers) })
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
    headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,PATCH'
    headers['Access-Control-Allow-Origin'] = '*'
    headers['Access-Control-Allow-Headers'] = 'Authorization,Content-Type,Cache-Control,X-Requested-With'
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
        return read(handlers, uri, up, reqId, getMaxAge(req.headers), req.headers['accept'], req.headers['if-none-match'], req.headers['if-modified-since'])
    if (req.method === 'DELETE')
        return remove(handlers, uri, up, reqId)
    if (req.method == 'PUT')
        return replace(handlers, uri, up, reqId, getMessage(req))
    if (req.method == 'PATCH')
        return update(handlers, uri, up, reqId, getMessage(req), req.headers['accept'])
    if (req.method == 'POST')
        return exec(handlers, uri, up, reqId, getMessage(req), req.headers['accept'], req)
    return Q.fcall(() => req.method === 'OPTIONS' ? new wfbase.BaseMsg(200, addCors()) : new wfbase.BaseMsg(405, null))
}

function getMessage(req: http.ServerRequest): wfbase.Msg {
    return new StreamMesg(0, req.headers, <any>req)
}

function read(handlers: wfbase.Handler[], uri: url.Url, up: wfbase.UserProfile, reqId: string, maxAge: number, accept: string, ifNoneMatch: string, ifModifiedSince: string): Q.Promise<wfbase.Msg> {
    var i = 0
        , res: Q.Promise<wfbase.Msg>
        , handler: wfbase.Handler
    for (; i < handlers.length; ++i) {
        handler = handlers[i]
        if (!handler.identified(uri))
            continue
        if (!handler.acceptable(accept))
            return Q.fcall(() => new wfbase.BaseMsg(406))
        return ifNoneMatch || ifModifiedSince ? handler.readConditional(uri, up, reqId, maxAge, accept, ifNoneMatch, ifModifiedSince) : handler.read(uri, up, reqId, maxAge, accept)
    }
    return null
}

function remove(handlers: wfbase.Handler[], uri: url.Url, up: wfbase.UserProfile, reqId: string): Q.Promise<wfbase.Msg> {
    var i = 0
        , res: Q.Promise<wfbase.Msg>
        , handler: wfbase.Handler
    for (; i < handlers.length; ++i) {
        handler = handlers[i]
        if (!handler.identified(uri))
            continue

        return handler.remove(uri, up, reqId)
    }
    return null
}

function replace(handlers: wfbase.Handler[], uri: url.Url, up: wfbase.UserProfile, reqId: string, message: wfbase.Msg): Q.Promise<wfbase.Msg> {
    var i = 0
        , res: Q.Promise<wfbase.Msg>
        , handler: wfbase.Handler
    for (; i < handlers.length; ++i) {
        handler = handlers[i]
        if (!handler.identified(uri))
            continue

        return handler.replace(uri, up, reqId, message)
    }
    return null
}

function update(handlers: wfbase.Handler[], uri: url.Url, up: wfbase.UserProfile, reqId: string, message: wfbase.Msg, accept: string): Q.Promise<wfbase.Msg> {
    var i = 0
        , res: Q.Promise<wfbase.Msg>
        , handler: wfbase.Handler
    for (; i < handlers.length; ++i) {
        handler = handlers[i]
        if (!handler.identified(uri))
            continue
        if (!handler.acceptable(accept))
            return Q.fcall(() => new wfbase.BaseMsg(406))

        return handler.acceptable(accept) && handlers[i].update(uri, up, reqId, message, accept)
    }
    return null
}

function exec(handlers: wfbase.Handler[], uri: url.Url, up: wfbase.UserProfile, reqId: string, message: wfbase.Msg, accept: string, req: http.ServerRequest): Q.Promise<wfbase.Msg> {
    var i = 0
        , res: Q.Promise<wfbase.Msg>
        , handler: wfbase.Handler
    for (; i < handlers.length; ++i) {
        handler = handlers[i]
        if (!handler.identified(uri))
            continue
        if (!handler.acceptable(accept))
            return Q.fcall(() => new wfbase.BaseMsg(406))
        
        if (!handler.acceptable(accept))
            return null
        if (!hasMultipartContentType(req.headers['content-type']))
            return handlers[i].exec(uri, up, reqId, message, accept)
        return parseForm(req).then(incomingMsg => handlers[i].exec(uri, up, reqId, incomingMsg, accept))
    }
    return null
}

function hasMultipartContentType(contentType: string): boolean {
    var header = HttpHeader.parse(contentType)
    return header && <any>header.part('multipart/form-data')
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

