// Copyright (c) ComUnity 2013
// hansm@comunity.co.za (Hans Malherbe)

///<reference path="../typed/node/node.d.ts" />
///<reference path="../typed/q/Q.d.ts" />
///<reference path="./node_modules/webframe-base/index.d.ts" />

import wfbase = require('webframe-base')

import pullStream = require('./pullStream')
import Q = require('q')
import stream = require('stream')

class StreamMsg extends wfbase.BaseMsg {
    constructor(statusCode:number, headers: any, private _is: stream.ReadableStream) { super(statusCode, headers) }
    respond(res: wfbase.Response): Q.Promise<wfbase.Msg> {
        this.setHeader(res, 'content-length')
        this.setHeaders(res)
        if (this.statusCode)
            res.writeHead(this.statusCode)
        if (this._is && this._is['paused']) {
            this._is['paused'] = false
            this._is.resume()
        }
        return res.pipefrom(this._is)
    }
    getBuffer(): Q.Promise<NodeBuffer> {
        return pullStream(this._is)
    }
}

export = StreamMsg