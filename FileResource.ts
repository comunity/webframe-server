// Copyright (c) ComUnity 2013
// hansm@comunity.co.za (Hans Malherbe)

///<reference path="../typed/node/node.d.ts" />
///<reference path="../typed/q/Q.d.ts" />
///<reference path="./node_modules/promisefy/index.d.ts" />
///<reference path="./node_modules/webframe-base/index.d.ts" />

import wfbase = require('webframe-base')

import fs = require('fs')
import p = require('promisefy')
import path = require('path')
import Q = require('q')
import stream = require('stream')
import StreamMesg = require('./StreamMesg')
var mime = require('mime')

class FileResource extends wfbase.Resource {
    constructor(private _filepath: string, private _logger: wfbase.Logger, private _autocreate?: boolean, private _headers?:any) {
        super()
    }

    exists(): Q.Promise<boolean> {
        return p.fileExists(this._filepath)
    }

    remove(track: string, accept: string): Q.Promise<wfbase.Msg> {
        var deferred = Q.defer<wfbase.Msg>()
        fs.unlink(this._filepath, err => {
            if (err) {
                if (err.code === 'ENOENT')
                    deferred.resolve(new wfbase.BaseMsg(404))
                else
                    deferred.reject(err)
            } else
                deferred.resolve(new wfbase.BaseMsg(204))
        })
        return deferred.promise
    }

    read(track: string, accept: string): Q.Promise<wfbase.Msg> {
        var start = process.hrtime()
        
        return <any>this.exists().then(exists => {
            if (!exists) {
                this._logger.log('error', track, start, 'GET', this._filepath, 404)
                return new wfbase.BaseMsg(404)
            }
            var fileStream = fs.createReadStream(this._filepath)
            this._logger.log('file', track, start, 'GET', this._filepath, 100)
            return new StreamMesg(200, null, <any> fileStream)
        })
    }

    replace(track: string, rep: wfbase.Msg): Q.Promise<wfbase.Msg> {
        var start = process.hrtime()
        return this._replace(track, rep, true, start, 'PUT').then(m => {
            this._logger.log('file', track, start, 'PUT', this._filepath, m.statusCode)
            return m
        })
    }

    private _replace(track: string, rep: wfbase.Msg, overwrite: boolean, start: number[], method: string): Q.Promise<wfbase.Msg> {
        var responder = new Responder(this._filepath, overwrite, this._logger, track, start, method)
        if (!this._autocreate) {
            rep.respond(responder)
            return responder.msg()
        }
        return p.mkdirp(path.dirname(this._filepath)).then(filepath => {
                rep.respond(responder)
                return responder.msg()
            }) 
    }

    exec(track: string, rep: wfbase.Msg, accept?: string): Q.Promise<wfbase.Msg> {
        var start = process.hrtime()
        return this._replace(track, rep, false, start, 'POST').then(m => {
            this._logger.log('file', track, start, 'POST', this._filepath, m.statusCode)
            return m
        })
    }
}

export = FileResource

class Responder implements wfbase.Response {
    private _msg: Q.Promise<wfbase.Msg>
    constructor(private _filepath: string, private _overwrite: boolean, private _logger: wfbase.Logger, private _track: string, private _start: number[], private _method: string) { }
    msg(): Q.Promise<wfbase.Msg> {
        return this._msg
    }
    writeHead(statusCode: number, reasonPhrase?: string, headers?: any): void {
    }
    setHeader(name: string, value: string): void {
    }
    end(data?: any, encoding?: string): void {
        if (!data) {
            this._msg = Q.fcall(() => new wfbase.BaseMsg(204))
            return
        }
        this._msg = p.writeFile(this._filepath, data, this._overwrite)
            .then(() => new wfbase.BaseMsg(204))
            .catch(err => {
                if (err.code === 'EEXIST')
                    return new wfbase.BaseMsg(409)
                this._logger.log('error', this._track, this._start, this._method, this._filepath, 500, null, null, err)
                return new wfbase.BaseMsg(500)
            })
    }
    pipefrom<T extends stream.Readable>(source: T): void {
        this._msg = p.pipe(source, <any>fs.createWriteStream(this._filepath, { flags: this._overwrite ? 'w' : 'wx' })).then(() => new wfbase.BaseMsg(204))
    }
}