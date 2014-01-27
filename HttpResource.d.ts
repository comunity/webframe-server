/// <reference path="../typed/node/node.d.ts" />
/// <reference path="../typed/q/Q.d.ts" />
/// <reference path="node_modules/webframe-base/index.d.ts" />
import wfbase = require('webframe-base');
declare class HttpResource extends wfbase.Resource {
    private _url;
    private _logger;
    private _dontthrow;
    constructor(_url: string, _logger: wfbase.Logger, _dontthrow?: boolean);
    public read(track: string, accept: string): Q.Promise<wfbase.Msg>;
    public exec(track: string, message: wfbase.Msg, accept?: string): Q.Promise<wfbase.Msg>;
    public replace(track: string, message: wfbase.Msg, accept?: string): Q.Promise<wfbase.Msg>;
    public remove(track: string, accept: string): Q.Promise<wfbase.Msg>;
}
export = HttpResource;
