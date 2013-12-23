// Copyright (c) ComUnity 2013
// hansm@comunity.co.za (Hans Malherbe)
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
///<reference path="../../typed/node/node.d.ts" />
///<reference path="../../typed/q/Q.d.ts" />
///<reference path="./node_modules/promisefy/index.d.ts" />
///<reference path="./node_modules/webframe-base/index.d.ts" />
var wfbase = require('webframe-base');

var crypto = require('crypto');
var fs = require('fs');
var p = require('promisefy');
var path = require('path');
var pullStream = require('./pullStream');
var Q = require('q');

var StreamMsg = require('./StreamMsg');

var filed = require('filed');

var FileResource = (function (_super) {
    __extends(FileResource, _super);
    function FileResource(_filepath, _logger, _autocreate) {
        _super.call(this);
        this._filepath = _filepath;
        this._logger = _logger;
        this._autocreate = _autocreate;
        this._md5tasks = [];
    }
    FileResource.prototype.md5 = function () {
        var _this = this;
        if (this._md5)
            return Q.fcall(function () {
                return _this._md5;
            });
        var deferred = Q.defer();
        this._md5tasks.push(deferred);
        if (this._md5tasks.length > 1)
            return deferred.promise;

        var hash = crypto.createHash('md5'), is = filed(this._filepath), reject = function (reason) {
            _this._md5tasks.forEach(function (def) {
                return def.reject(reason);
            });
            _this._md5tasks = [];
        };
        is.on('error', function (err) {
            return reject(err);
        });
        pullStream(is).then(function (buffer) {
            hash.update(buffer);
            _this._md5 = hash.digest();
            _this._md5tasks.forEach(function (def) {
                return def.resolve(_this._md5);
            });
            _this._md5tasks = [];
        }).fail(function (reason) {
            return reject(reason);
        });
        return deferred.promise;
    };

    FileResource.prototype.exists = function () {
        return p.fileExists(this._filepath);
    };

    FileResource.prototype.read = function (track, accept) {
        var _this = this;
        var start = process.hrtime();

        return this.exists().then(function (exists) {
            if (!exists) {
                _this._logger.log('error', track, {
                    method: 'GET',
                    url: _this._filepath,
                    start: start,
                    err: new Error('File Not Found')
                });
                new wfbase.Status(404, 'GET', _this._filepath, null, null, 'File Not Found').check(function (err) {
                    return new Error(err);
                });
            }
            var fileStream = filed(_this._filepath);

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
            _this._logger.log('file', track, {
                method: 'GET',
                url: _this._filepath,
                start: start
            });
            return new StreamMsg(0, null, fileStream);
        });
    };

    FileResource.prototype.replace = function (track, rep) {
        var _this = this;
        var start = process.hrtime();
        return this._replace(track, rep).then(function (m) {
            _this._logger.log('file', track, {
                method: 'PUT',
                url: _this._filepath,
                start: start
            });
            return m;
        });
    };

    FileResource.prototype._replace = function (track, rep) {
        var responder = new Responder(this._filepath);
        return (this._autocreate ? p.mkdirp(path.dirname(this._filepath)).then(function (filepath) {
            return rep.respond(responder);
        }) : rep.respond(responder));
    };

    FileResource.prototype.exec = function (track, rep, accept) {
        var _this = this;
        var start = process.hrtime();
        return this._replace(track, rep).then(function (m) {
            _this._logger.log('file', track, {
                method: 'POST',
                url: _this._filepath,
                start: start
            });
            return m;
        });
    };
    return FileResource;
})(wfbase.Resource);


var Responder = (function () {
    function Responder(filepath) {
        this.filepath = filepath;
    }
    Responder.prototype.writeHead = function (statusCode, reasonPhrase, headers) {
    };
    Responder.prototype.setHeader = function (name, value) {
    };
    Responder.prototype.end = function (data, encoding) {
        if (!data)
            return Q.fcall(function () {
                return new wfbase.BaseMsg(204);
            });
        return p.writeFile(this.filepath, data).then(function () {
            return new wfbase.BaseMsg(204);
        });
    };
    Responder.prototype.pipefrom = function (source) {
        return p.pipe(source, fs.createWriteStream(this.filepath)).then(function () {
            return new wfbase.BaseMsg(204);
        });
    };
    return Responder;
})();
module.exports = FileResource;
