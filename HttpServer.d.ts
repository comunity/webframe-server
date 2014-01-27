/// <reference path="../typed/node/node.d.ts" />
/// <reference path="../typed/q/Q.d.ts" />
/// <reference path="node_modules/webframe-base/index.d.ts" />
/// <reference path="node_modules/promisefy/index.d.ts" />
import wfbase = require('webframe-base');
import http = require('http');
declare class HttpServer {
    public server: http.Server;
    public handlers: wfbase.Handler[];
    constructor(port: number, authn: wfbase.Authenticate, errorLog: wfbase.Logger);
    public close(): void;
    public add(handler: wfbase.Handler): void;
}
export = HttpServer;
