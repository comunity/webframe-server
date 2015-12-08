// Copyright (c) ComUnity 2013
// hansm@comunity.co.za (Hans Malherbe)

///<reference path="../typed/node/node.d.ts" />
///<reference path="../typed/q/Q.d.ts" />
///<reference path="./node_modules/webframe-base/index.d.ts" />
///<reference path="./node_modules/promisefy/index.d.ts" />

import wfbase = require('webframe-base')

import http = require('http')
import memoryStream = require('./memoryStream')
import p = require('promisefy')
import Q = require('q')
import stream = require('stream')
import StreamMesg = require('./StreamMesg')

var hyperquest = require('hyperquest')
    , through = require('through')

class HttpResource extends wfbase.Resource {
    constructor(private _url: string, private _logger: wfbase.Logger, private _dontthrow?: boolean) { super() }
    read(track: string, accept: string): Q.Promise<wfbase.Msg> {
        var responder = new Responder('GET', this._url, track, this._logger, this._dontthrow, accept)
        new wfbase.BaseMsg(0).respond(responder)
        return responder.msg()
    }
    exec(track: string, message: wfbase.Msg, accept?: string): Q.Promise<wfbase.Msg> {
        var responder = new Responder('POST', this._url, track, this._logger, this._dontthrow, accept)
        message.respond(responder)
        return responder.msg()
    }
    replace(track: string, message: wfbase.Msg, accept?: string): Q.Promise<wfbase.Msg> {
        var responder = new Responder('PUT', this._url, track, this._logger, this._dontthrow, accept)
        message.respond(responder)
        return responder.msg()
    }
    remove(track: string, accept: string): Q.Promise<wfbase.Msg> {
        var responder = new Responder('DELETE', this._url, track, this._logger, this._dontthrow, accept)
        new wfbase.BaseMsg(0).respond(responder)
        return responder.msg()
    }
    update(track: string, message: wfbase.Msg, accept?: string): Q.Promise<wfbase.Msg> {
        var responder = new Responder('PATCH', this._url, track, this._logger, this._dontthrow, accept)
        message.respond(responder)
        return responder.msg()
    }
}

export = HttpResource 

class HttpResponse {
    constructor(public url: string, public res: wfbase.Msg) { }
}

class Responder implements wfbase.Response {
    private statusCode: number
    private headers: any
    private reasonPhrase: string
    private _msg: Q.Promise<wfbase.Msg>
    constructor(private _method: string, private _url: string, private _track: string, private _logger: wfbase.Logger, private _dontthrow: boolean, private _accept: string) {
        this.statusCode = 0
        this.headers = {}
        if (this._accept)
            this.headers.accept = this._accept
    }
    msg(): Q.Promise<wfbase.Msg> {
        return this._msg
    }
    writeHead(statusCode: number, reasonPhrase?: string, headers?: any): void {
        this.statusCode = statusCode
        if (reasonPhrase)
            this.reasonPhrase = reasonPhrase
        if (headers)
            this.headers = headers
    }
    setHeader(name: string, value: string): void {
        this.headers[name] = value
    }
    end(data?: any, encoding?: string): void {
        this._msg = data ? request(this._method, this._url, this.headers, this._track, this._logger, this._dontthrow, memoryStream(data)) : request(this._method, this._url, this.headers, this._track, this._logger, this._dontthrow)
    }
    pipefrom<T extends stream.Readable>(source: T): void {
        this._msg = request(this._method, this._url, this.headers, this._track, this._logger, this._dontthrow, source)
    }
}

function request(m: string, u: string, headers: any, track: string, logger: wfbase.Logger, dontthrow?: boolean, is?: stream.Readable): Q.Promise<wfbase.Msg> {
    var start = process.hrtime()
    var deferred: Q.Deferred<wfbase.Msg> = Q.defer<wfbase.Msg>()
        , retries = 0
    go(m, u)
    return deferred.promise
    function go(method: string, url: string) {
        var formdata = []
        ++retries
        var os = hyperquest(url, {
                method: method,
                headers: headers
            }, function (err: Error, response: http.ClientResponse) {
                if (err) {
                    logger.log('outError', track, start, method, url, 500, null, wfbase.privatiseHeaders(headers), err)
                    return deferred.reject(wfbase.statusError(500, () => err, method, url))
                }
                var location = response.headers['location']
                    , code = response.statusCode
                if (retries < 5 && location && (code === 301 || code === 302 || code === 303)) {
                    logger.log('redirect', track, start, method, url, code, null, wfbase.privatiseHeaders(headers))
                    return go('GET', location)
                } else {
                    logger.log('out', track, start, method, url, code, null, wfbase.privatiseHeaders(headers), null, formdata ? Buffer.concat(formdata).toString() : null) 
                }
                if (!dontthrow && (code < 200 || code >= 300))
                    return deferred.reject(new wfbase.Status(code, method, url, response.headers).error(err => new Error(err)))
                if (response.pause) {
                    response.pause()
                    response['paused'] = true
                }
                return deferred.resolve(new StreamMesg(code, response.headers, <any>response))
            })
        if (is && method !== 'GET' && method !== 'DELETE') {
            is.on('error', err => deferred.reject(wfbase.statusError(500, () => new Error(err), method, url)))
            if (is.resume && is['paused']) {
                is['paused'] = false
                is.resume()
            }
            is.pipe(through(function write(data) {
                this.queue(data)
                formdata.push(data)
            },
            function end() { 
                this.queue(null)
            })).pipe(os)
        }
    }
}

