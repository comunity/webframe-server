// Copyright (c) ComUnity 2013
// hansm@comunity.co.za (Hans Malherbe)
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
///<reference path="../typed/node/node.d.ts" />
///<reference path="../typed/q/Q.d.ts" />
///<reference path="../typed/underscore.string/underscore.string.d.ts" />
///<reference path="./node_modules/webframe-base/index.d.ts" />
var wfbase = require('webframe-base');

var _s = require('underscore.string');
var FileResource = require('./FileResource');
var path = require('path');

var FileHandler = (function (_super) {
    __extends(FileHandler, _super);
    function FileHandler(_basepath, _virtualroot, _logger) {
        _super.call(this);
        this._basepath = _basepath;
        this._virtualroot = _virtualroot;
        this._logger = _logger;
    }
    FileHandler.prototype.identified = function (uri) {
        return _s.startsWith(uri.pathname, this._virtualroot + '/');
    };

    FileHandler.prototype.read = function (uri, up, reqId, headers, maxAge) {
        var filepath = path.join(this._basepath, decodeURIComponent(uri.pathname).substring(this._virtualroot.length));
        return new FileResource(filepath, this._logger, false, headers).read(reqId, null);
    };
    return FileHandler;
})(wfbase.Handler);

module.exports = FileHandler;
