// Copyright (c) ComUnity 2013
// hansm@comunity.co.za (Hans Malherbe)

///<reference path="../../typed/node/node.d.ts" />
///<reference path="../../typed/q/Q.d.ts" />
///<reference path="./node_modules/promisefy/index.d.ts" />
///<reference path="./node_modules/webframe-base/index.d.ts" />

import wfbase = require('webframe-base')

import crypto = require('crypto')
import fs = require('fs')
import p = require('promisefy')
import path = require('path')
import pullStream = require('./pullStream')
import Q = require('q')
import stream = require('stream')
import StreamMsg = require('./StreamMsg')

var filed = require('filed')

class FileResource extends wfbase.Resource {
    private _md5tasks: Q.Deferred<NodeBuffer>[]
    private _md5: NodeBuffer
    constructor(private _filepath: string, private _logger: wfbase.Logger, private _autocreate?: boolean) {
        super()
        this._md5tasks = []
    }

    md5(): Q.Promise<NodeBuffer> {
        if (this._md5)
            return Q.fcall(() => this._md5)
        var deferred: Q.Deferred<NodeBuffer> = Q.defer<NodeBuffer>()
        this._md5tasks.push(deferred)
        if (this._md5tasks.length > 1) 
            return deferred.promise

        var hash = crypto.createHash('md5')
            , is = filed(this._filepath)
            , reject = reason => {
                this._md5tasks.forEach(def => def.reject(reason))
                this._md5tasks = []
            }
        is.on('error', err => reject(err))
        pullStream(is).then(buffer => {
            hash.update(buffer)
            this._md5 = <any> hash.digest()
            this._md5tasks.forEach(def => def.resolve(this._md5))
            this._md5tasks = []
        }).fail(reason => reject(reason))
        return deferred.promise
    }

    exists(): Q.Promise<boolean> {
        return p.fileExists(this._filepath)
    }

    read(track: string, accept: string): Q.Promise<wfbase.Msg> {
        var start = process.hrtime()

        return this.exists().then(exists => {
            if (!exists) {
                this._logger.log('error', track, {
                    method: 'GET',
                    url: this._filepath,
                    start: start,
                    err: new Error('File Not Found')
                })
                new wfbase.Status(404, 'GET', this._filepath, null, null, 'File Not Found').check(err => new Error(err))
            }
            var fileStream = filed(this._filepath)
            //fileStream.on('error', err => {
            //    this._logger.log('error', track, {
            //        method: 'GET',
            //        url: this._filepath,
            //        start: start,
            //        err: new Error(err)
            //    })
            //})
            //fileStream.on('finish', () => {
            //    this._logger.log('file', track, {
            //        method: 'GET',
            //        url: this._filepath,
            //        start: start
            //    })
            //})
            //fileStream.on('end', () => {
            //    this._logger.log('file', track, {
            //        method: 'GET',
            //        url: this._filepath,
            //        start: start
            //    })
            //})
            this._logger.log('file', track, {
                method: 'GET',
                url: this._filepath,
                start: start
            })
            return new StreamMsg(0, null, <any> fileStream)
        })
    }

    replace(track: string, rep: wfbase.Msg): Q.Promise<wfbase.Msg> {
        var start = process.hrtime()
        return this._replace(track, rep).then(m => {
            this._logger.log('file', track, {
                method: 'PUT',
                url: this._filepath,
                start: start
            })
            return m
        })
    }

    private _replace(track: string, rep: wfbase.Msg): Q.Promise<wfbase.Msg> {
        var responder = new Responder(this._filepath)
        return (this._autocreate ? p.mkdirp(path.dirname(this._filepath)).then(filepath => rep.respond(responder)) : rep.respond(responder))
    }

    exec(track: string, rep: wfbase.Msg, accept?: string): Q.Promise<wfbase.Msg> {
        var start = process.hrtime()
        return this._replace(track, rep).then(m => {
            this._logger.log('file', track, {
                method: 'POST',
                url: this._filepath,
                start: start
            })
            return m
        })
    }
}

export = FileResource

class Responder implements wfbase.Response {
    constructor(private filepath: string) { }
    writeHead(statusCode: number, reasonPhrase?: string, headers?: any): void {
    }
    setHeader(name: string, value: string): void {
    }
    end(data?: any, encoding?: string): Q.Promise<wfbase.Msg> {
        if (!data)
            return Q.fcall(() => new wfbase.BaseMsg(204))
        return p.writeFile(this.filepath, data).then(() => new wfbase.BaseMsg(204))
    }
    pipefrom<T extends stream.ReadableStream>(source: T): Q.Promise<wfbase.Msg> {
        return p.pipe(source, fs.createWriteStream(this.filepath)).then(() => new wfbase.BaseMsg(204))
    }
}