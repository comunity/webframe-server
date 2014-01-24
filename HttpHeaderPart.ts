class HttpHeaderPart {
    constructor(private _name: string, private _options: any) {
    }

    name(): string {
        return this._name
    }

    option(name: string): any {
        return this._options[name]
    }

    static parse(s: string): HttpHeaderPart {
        var parts = s && s.split(';')
        if (!parts || parts.length === 0)
            return
        var options = {}
        var i = 0
        for (; i < parts.length; ++i) {
            var pair = parts[i] && parts[i].split('=')
            if (pair.length < 1)
                continue
            options[pair[0].trim()] = pair.length < 2 ? true : pair[1].trim()
        }
        return new HttpHeaderPart(parts[0].trim(), options)
    }
}

export = HttpHeaderPart