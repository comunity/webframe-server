// Copyright (c) ComUnity 2013
// hansm@comunity.co.za (Hans Malherbe)

///<reference path="../typed/node/node.d.ts" />
///<reference path="./node_modules/webframe-base/index.d.ts" />
///<reference path="./node_modules/promisefy/index.d.ts" />

import http = require('http')
import p = require('promisefy')
import stream = require('stream')
import wfbase = require('webframe-base')

class ServerResponse implements wfbase.Response {
    constructor(private _res: http.ServerResponse) {
    }
    writeHead(statusCode: number, reasonPhrase?: string, headers?: any): void {
        this._res.writeHead(statusCode, reasonPhrase, headers)
    }
    setHeader(name: string, value: string): void {
        this._res.setHeader(name, value)
    }
    end(data?: any, encoding?: string): void {
        this._res.end(data, encoding)
    }
    pipefrom<T extends stream.ReadableStream>(source: T): void {
        p.pipe(source, this._res)
    }
}

export = ServerResponse