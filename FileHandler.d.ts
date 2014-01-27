/// <reference path="../typed/node/node.d.ts" />
/// <reference path="../typed/q/Q.d.ts" />
/// <reference path="../typed/underscore.string/underscore.string.d.ts" />
/// <reference path="node_modules/webframe-base/index.d.ts" />
import wfbase = require('webframe-base');
import url = require('url');
declare class FileHandler extends wfbase.Handler {
    private _basepath;
    private _virtualroot;
    private _logger;
    constructor(_basepath: string, _virtualroot: string, _logger: wfbase.Logger);
    public identified(uri: url.Url): boolean;
    public read(uri: url.Url, user: string, reqId: string, maxAge: number, accept: string): Q.Promise<wfbase.Msg>;
}
export = FileHandler;
