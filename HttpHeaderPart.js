var HttpHeaderPart = (function () {
    function HttpHeaderPart(_name, _options) {
        this._name = _name;
        this._options = _options;
    }
    HttpHeaderPart.prototype.name = function () {
        return this._name;
    };

    HttpHeaderPart.prototype.option = function (name) {
        return this._options[name];
    };

    HttpHeaderPart.parse = function (s) {
        var parts = s && s.split(';');
        if (!parts || parts.length === 0)
            return;
        var options = {};
        var i = 0;
        for (; i < parts.length; ++i) {
            var pair = parts[i] && parts[i].split('=');
            if (pair.length < 1)
                continue;
            options[pair[0].trim()] = pair.length < 2 ? true : pair[1].trim();
        }
        return new HttpHeaderPart(parts[0].trim(), options);
    };
    return HttpHeaderPart;
})();

module.exports = HttpHeaderPart;
