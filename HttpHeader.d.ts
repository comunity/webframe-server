import HttpHeaderPart = require('./HttpHeaderPart');
declare class HttpHeader {
    private _parts;
    constructor(_parts: HttpHeaderPart[]);
    public part(name: string): HttpHeaderPart;
    static parse(s: string): HttpHeader;
}
export = HttpHeader;
