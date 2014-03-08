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
///<reference path="./node_modules/webframe-base/index.d.ts" />
var wfbase = require('webframe-base');

var pullStream = require('./pullStream');

var StreamMesg = (function (_super) {
    __extends(StreamMesg, _super);
    function StreamMesg(statusCode, headers, _is) {
        _super.call(this, statusCode, headers);
        this._is = _is;
    }
    StreamMesg.prototype.respond = function (res) {
        this.setHeader(res, 'content-length');
        this.setHeaders(res);

        if (this.statusCode)
            res.writeHead(this.statusCode);

        if (this._is && this.headers && this.headers['content-type']) {
            this._is['mimetype'] = this.headers['content-type'];
        }

        if (this._is && this._is['paused']) {
            this._is['paused'] = false;
            this._is.resume();
        }
        res.pipefrom(this._is);
    };
    StreamMesg.prototype.getBuffer = function () {
        return pullStream(this._is);
    };
    return StreamMesg;
})(wfbase.BaseMsg);

module.exports = StreamMesg;
