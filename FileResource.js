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
///<reference path="./node_modules/promisefy/index.d.ts" />
///<reference path="./node_modules/webframe-base/index.d.ts" />
var wfbase = require('webframe-base');

var fs = require('fs');
var p = require('promisefy');
var path = require('path');
var Q = require('q');

var StreamMesg = require('./StreamMesg');

var FileResource = (function (_super) {
    __extends(FileResource, _super);
    function FileResource(_filepath, _logger, _autocreate) {
        _super.call(this);
        this._filepath = _filepath;
        this._logger = _logger;
        this._autocreate = _autocreate;
    }
    FileResource.prototype.exists = function () {
        return p.fileExists(this._filepath);
    };

    FileResource.prototype.remove = function (track, accept) {
        var deferred = Q.defer();
        fs.unlink(this._filepath, function (err) {
            if (err) {
                if (err.code === 'ENOENT')
                    deferred.resolve(new wfbase.BaseMsg(404));
                else
                    deferred.reject(err);
            } else
                deferred.resolve(new wfbase.BaseMsg(204));
        });
        return deferred.promise;
    };

    FileResource.prototype.read = function (track, accept) {
        var _this = this;
        var start = process.hrtime();

        return this.exists().then(function (exists) {
            if (!exists) {
                _this._logger.log('error', track, start, 'GET', _this._filepath, 404);
                throw wfbase.statusError(404, function () {
                    return new Error('File Not Found');
                });
            }
            var fileStream = fs.createReadStream(_this._filepath);
            _this._logger.log('file', track, start, 'GET', _this._filepath, 100);
            return new StreamMesg(0, null, fileStream);
        });
    };

    FileResource.prototype.replace = function (track, rep) {
        var _this = this;
        var start = process.hrtime();
        return this._replace(track, rep, true, start, 'PUT').then(function (m) {
            _this._logger.log('file', track, start, 'PUT', _this._filepath, m.statusCode);
            return m;
        });
    };

    FileResource.prototype._replace = function (track, rep, overwrite, start, method) {
        var responder = new Responder(this._filepath, overwrite, this._logger, track, start, method);
        if (!this._autocreate) {
            rep.respond(responder);
            return responder.msg();
        }
        return p.mkdirp(path.dirname(this._filepath)).then(function (filepath) {
            rep.respond(responder);
            return responder.msg();
        });
    };

    FileResource.prototype.exec = function (track, rep, accept) {
        var _this = this;
        var start = process.hrtime();
        return this._replace(track, rep, false, start, 'POST').then(function (m) {
            _this._logger.log('file', track, start, 'POST', _this._filepath, m.statusCode);
            return m;
        });
    };
    return FileResource;
})(wfbase.Resource);


var Responder = (function () {
    function Responder(_filepath, _overwrite, _logger, _track, _start, _method) {
        this._filepath = _filepath;
        this._overwrite = _overwrite;
        this._logger = _logger;
        this._track = _track;
        this._start = _start;
        this._method = _method;
    }
    Responder.prototype.msg = function () {
        return this._msg;
    };
    Responder.prototype.writeHead = function (statusCode, reasonPhrase, headers) {
    };
    Responder.prototype.setHeader = function (name, value) {
    };
    Responder.prototype.end = function (data, encoding) {
        var _this = this;
        if (!data) {
            this._msg = Q.fcall(function () {
                return new wfbase.BaseMsg(204);
            });
            return;
        }
        this._msg = p.writeFile(this._filepath, data, this._overwrite).then(function () {
            return new wfbase.BaseMsg(204);
        }).catch(function (err) {
            if (err.code === 'EEXIST')
                return new wfbase.BaseMsg(409);
            _this._logger.log('error', _this._track, _this._start, _this._method, _this._filepath, 500, null, null, err);
            return new wfbase.BaseMsg(500);
        });
    };
    Responder.prototype.pipefrom = function (source) {
        this._msg = p.pipe(source, fs.createWriteStream(this._filepath, { flags: this._overwrite ? 'w' : 'wx' })).then(function () {
            return new wfbase.BaseMsg(204);
        });
    };
    return Responder;
})();
module.exports = FileResource;
