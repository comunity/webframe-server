import HttpHeaderPart = require('./HttpHeaderPart')

class HttpHeader {
    constructor(private _parts: HttpHeaderPart[]) {
    }

    part(name: string): HttpHeaderPart {
        var i = 0
        for (; i < this._parts.length; ++i) {
            if (name === this._parts[i].name())
                return this._parts[i]
        }
    }

    static parse(s: string): HttpHeader {
        if (!s)
            return
        return new HttpHeader(s.split(',').map(part => HttpHeaderPart.parse(part)))
    }
}

export = HttpHeader