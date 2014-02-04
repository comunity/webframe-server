/// <reference path="../typed/node/node.d.ts" />
/// <reference path="../typed/q/Q.d.ts" />
/// <reference path="node_modules/promisefy/index.d.ts" />
/// <reference path="node_modules/webframe-base/index.d.ts" />
import wfbase = require('webframe-base');
declare class FileResource extends wfbase.Resource {
    private _filepath;
    private _logger;
    private _autocreate;
    constructor(_filepath: string, _logger: wfbase.Logger, _autocreate?: boolean);
    public exists(): Q.Promise<boolean>;
    public read(track: string, accept: string): Q.Promise<wfbase.Msg>;
    public replace(track: string, rep: wfbase.Msg): Q.Promise<wfbase.Msg>;
    private _replace(track, rep);
    public exec(track: string, rep: wfbase.Msg, accept?: string): Q.Promise<wfbase.Msg>;
}
export = FileResource;
