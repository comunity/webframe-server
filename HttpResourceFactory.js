// Copyright (c) ComUnity 2013
// hansm@comunity.co.za (Hans Malherbe)
var HttpResource = require('./HttpResource');

var HttpResourceFactory = (function () {
    function HttpResourceFactory(_logger, _dontthrow) {
        this._logger = _logger;
        this._dontthrow = _dontthrow;
    }
    HttpResourceFactory.prototype.create = function (url, user, pw) {
        return new HttpResource(url, this._logger, this._dontthrow);
    };
    return HttpResourceFactory;
})();

module.exports = HttpResourceFactory;
