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
import StreamMsg = require('./StreamMsg')
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
    pipefrom<T extends stream.ReadableStream>(source: T): Q.Promise<wfbase.Msg> {
        return p.pipe(source, this._res).then(hrtime => null)
    }
}

function setupRequestListener(handlers: wfbase.Handler[], authn: wfbase.Authenticate, errorLog: wfbase.Logger) {
    return (req: http.ServerRequest, res: http.ServerResponse) => {
        var reqId = errorLog.id()
        var start = process.hrtime()
        var authHeader = req.headers['authorization']
        res.on('close', () => errorLog.log('error', reqId, { method: req.method, url: req.url, err: new Error('Connection closed'), start: start, headers: addCors(wfbase.privatiseHeaders(req.headers)) }))
        res.on('finish', () => errorLog.log('in', reqId, { method: req.method, url: req.url, statusCode: res.statusCode, start: start, headers: wfbase.privatiseHeaders(req.headers) }))
        if (!authHeader) 
            return handle(req, res, null, null, reqId, start)
        check(authHeader, reqId).then((creds: any) => {
            if (creds)
                handle(req, res, creds.user, creds.password, reqId, start)
            else
                mustAuthenticate(res)
        }).fail(err => {
            mustAuthenticate(res)
        })
    }
    function mustAuthenticate(res: http.ServerResponse): void {
        res.writeHead(401, addCors({ 'WWW-Authenticate': 'Basic realm="CU"' }))
        res.end()
    }
    function check(authHeader: string, reqId: string): Q.Promise<any> {
        var token = authHeader.split(/\s+/).pop() || ''
        var auth = new Buffer(token, 'base64').toString()
        var parts = auth.split(/:/)
        var user = parts[0]
        var password = parts[1]
        if (!authn)
            return Q.fcall(() => {
                return { user: user, password: password }
            })
        return authn.check(user, password, reqId).then(valid => valid ? { user: user, password: password } : null)
    }
    function handle(req: http.ServerRequest, res: http.ServerResponse, user: string, pw: string, reqId: string, start: number[]) {
        try {
            var incoming = getResponse(handlers, req, user, pw, reqId)
            if (!incoming) {
                    res.writeHead(404, addCors({}))
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

        function handleError(err: any) {
            errorLog.log('error', reqId, { method: req.method, url: req.url, err: err, stack: err.stack, start: start, user: user, password: pw, headers: wfbase.privatiseHeaders(req.headers) })
            if (err.detail && err.detail.statusCode) {
                res.writeHead(err.detail.statusCode, addCors({ 'content-type': 'application/json' }))
                return res.end(JSON.stringify(err.detail))
            }
            if (err.statusCode) {
                res.writeHead(err.statusCode, err.toString())
                return res.end()
            }
            res.writeHead(500, addCors({}))
            res.end()
        }
    }
}

function addCors(headers) {
    headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,PATCH'
    headers['Access-Control-Allow-Origin'] = '*'
    headers['Access-Control-Allow-Headers'] = 'Authorization,Content-Type'
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

function getResponse(handlers: wfbase.Handler[], req: http.ServerRequest, user: string, pw: string, reqId: string): Q.Promise<wfbase.Msg> {
    var uri = url.parse('http://' + req.headers['host'] + req.url)
    if (req.method === 'GET')
        return read(handlers, uri, user, pw, reqId, getMaxAge(req.headers), req.headers['accept'])
    if (req.method === 'DELETE')
        return remove(handlers, uri, user, pw, reqId)
    if (req.method == 'PUT')
        return replace(handlers, uri, user, pw, reqId, getMessage(req))
    if (req.method == 'PATCH')
        return update(handlers, uri, user, pw, reqId, getMessage(req), req.headers['accept'])
    if (req.method == 'POST')
        return exec(handlers, uri, user, pw, reqId, getMessage(req), req.headers['accept'], req)
    return Q.fcall(() => req.method === 'OPTIONS' ? new wfbase.BaseMsg(200, addCors({})) : new wfbase.BaseMsg(405, null))
}

function getMessage(req: http.ServerRequest): wfbase.Msg {
    return new StreamMsg(0, req.headers, req)
}

function read(handlers: wfbase.Handler[], uri: url.Url, user: string, pw: string, reqId: string, maxAge: number, accept: string): Q.Promise<wfbase.Msg> {
    var i = 0
        , res: Q.Promise<wfbase.Msg>
        , handler: wfbase.Handler
    for (; i < handlers.length; ++i) {
        handler = handlers[i]
        if (!handler.identified(uri))
            continue
        if (!handler.acceptable(accept))
            return Q.fcall(() => new wfbase.BaseMsg(406))
        return handler.read(uri, user, reqId, maxAge, accept)
    }
    return null
}

function remove(handlers: wfbase.Handler[], uri: url.Url, user: string, pw: string, reqId: string): Q.Promise<wfbase.Msg> {
    var i = 0
        , res: Q.Promise<wfbase.Msg>
        , handler: wfbase.Handler
    for (; i < handlers.length; ++i) {
        handler = handlers[i]
        if (!handler.identified(uri))
            continue

        return handler.remove(uri, user, reqId)
    }
    return null
}

function replace(handlers: wfbase.Handler[], uri: url.Url, user: string, pw: string, reqId: string, message: wfbase.Msg): Q.Promise<wfbase.Msg> {
    var i = 0
        , res: Q.Promise<wfbase.Msg>
        , handler: wfbase.Handler
    for (; i < handlers.length; ++i) {
        handler = handlers[i]
        if (!handler.identified(uri))
            continue

        return handler.replace(uri, user, reqId, message)
    }
    return null
}

function update(handlers: wfbase.Handler[], uri: url.Url, user: string, pw: string, reqId: string, message: wfbase.Msg, accept: string): Q.Promise<wfbase.Msg> {
    var i = 0
        , res: Q.Promise<wfbase.Msg>
        , handler: wfbase.Handler
    for (; i < handlers.length; ++i) {
        handler = handlers[i]
        if (!handler.identified(uri))
            continue
        if (!handler.acceptable(accept))
            return Q.fcall(() => new wfbase.BaseMsg(406))

        return handler.acceptable(accept) && handlers[i].update(uri, user, reqId, message, accept)
    }
    return null
}

function exec(handlers: wfbase.Handler[], uri: url.Url, user: string, pw: string, reqId: string, message: wfbase.Msg, accept: string, req: http.ServerRequest): Q.Promise<wfbase.Msg> {
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
            return handlers[i].exec(uri, user, reqId, message, accept)
        return parseForm(req).then(incomingMsg => handlers[i].exec(uri, user, reqId, incomingMsg, accept))
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

