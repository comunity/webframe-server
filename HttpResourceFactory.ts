// Copyright (c) ComUnity 2013
// hansm@comunity.co.za (Hans Malherbe)

///<reference path="./node_modules/webframe-base/index.d.ts" />

import wfbase = require('webframe-base')

import HttpResource = require('./HttpResource')

class HttpResourceFactory implements wfbase.ResourceFactory {
    constructor(private _logger: wfbase.Logger, private _dontthrow?: boolean) { }
    create(url: string, user: string, pw: string): wfbase.Resource {
        return new HttpResource(url, this._logger, this._dontthrow)
    }
}

export = HttpResourceFactory