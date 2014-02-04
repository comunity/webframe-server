/// <reference path="../typed/node/node.d.ts" />
/// <reference path="node_modules/webframe-base/index.d.ts" />
/// <reference path="node_modules/promisefy/index.d.ts" />
import http = require('http');
import stream = require('stream');
import wfbase = require('webframe-base');
declare class ServerResponse implements wfbase.Response {
    private _res;
    constructor(_res: http.ServerResponse);
    public writeHead(statusCode: number, reasonPhrase?: string, headers?: any): void;
    public setHeader(name: string, value: string): void;
    public end(data?: any, encoding?: string): void;
    public pipefrom<T extends stream.ReadableStream>(source: T): void;
}
export = ServerResponse;
