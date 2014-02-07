// Copyright (c) ComUnity 2013
// hansm@comunity.co.za (Hans Malherbe)

///<reference path="../typed/node/node.d.ts" />
///<reference path="../typed/q/Q.d.ts" />
///<reference path="../typed/underscore.string/underscore.string.d.ts" />
///<reference path="./node_modules/webframe-base/index.d.ts" />

import wfbase = require('webframe-base')

import _s = require('underscore.string')
import FileResource = require('./FileResource')
import path = require('path')
import url = require('url')

class FileHandler extends wfbase.Handler {
    constructor(private _basepath: string, private _virtualroot: string, private _logger: wfbase.Logger) {
        super()
    }

    identified(uri: url.Url) {
        return _s.startsWith(uri.pathname, this._virtualroot + '/')
    }

    read(uri: url.Url, up: wfbase.UserProfile, reqId: string, maxAge: number, accept: string): Q.Promise<wfbase.Msg> {
        var filepath = path.join(this._basepath, decodeURIComponent(uri.pathname).substring(this._virtualroot.length))
        return new FileResource(filepath, this._logger).read(reqId, null)
    }
}

export = FileHandler