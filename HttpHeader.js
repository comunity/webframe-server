var HttpHeaderPart = require('./HttpHeaderPart');

var HttpHeader = (function () {
    function HttpHeader(_parts) {
        this._parts = _parts;
    }
    HttpHeader.prototype.part = function (name) {
        var i = 0;
        for (; i < this._parts.length; ++i) {
            if (name === this._parts[i].name())
                return this._parts[i];
        }
    };

    HttpHeader.parse = function (s) {
        if (!s)
            return;
        return new HttpHeader(s.split(',').map(function (part) {
            return HttpHeaderPart.parse(part);
        }));
    };
    return HttpHeader;
})();

module.exports = HttpHeader;
