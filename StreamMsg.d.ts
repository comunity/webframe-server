/// <reference path="../typed/node/node.d.ts" />
/// <reference path="../typed/q/Q.d.ts" />
/// <reference path="node_modules/webframe-base/index.d.ts" />
import wfbase = require('webframe-base');
import stream = require('stream');
declare class StreamMsg extends wfbase.BaseMsg {
    private _is;
    constructor(statusCode: number, headers: any, _is: stream.ReadableStream);
    public respond(res: wfbase.Response): void;
    public getBuffer(): Q.Promise<NodeBuffer>;
}
export = StreamMsg;
