declare class HttpHeaderPart {
    private _name;
    private _options;
    constructor(_name: string, _options: any);
    public name(): string;
    public option(name: string): any;
    static parse(s: string): HttpHeaderPart;
}
export = HttpHeaderPart;
