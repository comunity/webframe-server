// Copyright (c) ComUnity 2013
// hansm@comunity.co.za (Hans Malherbe)

///<reference path="../typed/node/node.d.ts" />
///<reference path="../typed/q/Q.d.ts" />
///<reference path="./node_modules/webframe-base/index.d.ts" />

import wfbase = require('webframe-base')

import pullStream = require('./pullStream')
import Q = require('q')
import stream = require('stream')

class StreamMesg extends wfbase.BaseMsg {
    constructor(statusCode:number, headers: any, private _is: stream.Readable) { super(statusCode, headers) }
    respond(res: wfbase.Response): void {
        this.setHeader(res, 'content-length')
        this.setHeaders(res)

        if (this.statusCode)
            res.writeHead(this.statusCode)

        if (this._is && this.headers && this.headers['content-type']) {
            this._is['mimetype'] = this.headers['content-type']
        }

        if (this._is && this._is['paused']) {
            this._is['paused'] = false
            this._is.resume()
        }
        res.pipefrom(this._is)
    }
    getBuffer(): Q.Promise<NodeBuffer> {
        return pullStream(this._is)
    }
}

export = StreamMesg