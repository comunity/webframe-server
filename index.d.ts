declare module 'webframe-server' {
    import http = require('http');
    import url = require('url');
    import stream = require('stream');
    import wfbase = require('webframe-base')
    export class FileHandler extends wfbase.Handler {
        private _basepath;
        private _virtualroot;
        private _logger;
        constructor(_basepath: string, _virtualroot: string, _logger: wfbase.Logger);
        public identified(uri: url.Url): boolean;
        public read(uri: url.Url, user: string, reqId: string, accept: string): Q.Promise<wfbase.Msg>;
    }
    export class FileResource extends wfbase.Resource {
        private _filepath;
        private _logger;
        private _autocreate;
        private _md5tasks;
        private _md5;
        constructor(_filepath: string, _logger: wfbase.Logger, _autocreate?: boolean);
        public md5(): Q.Promise<NodeBuffer>;
        public exists(): Q.Promise<boolean>;
        public read(track: string, accept: string): Q.Promise<wfbase.Msg>;
        public replace(track: string, rep: wfbase.Msg): Q.Promise<wfbase.Msg>;
        private _replace(track, rep);
        public exec(track: string, rep: wfbase.Msg, accept?: string): Q.Promise<wfbase.Msg>;
    }
    export class HttpResource extends wfbase.Resource {
        private _url;
        private _logger;
        private _dontthrow;
        constructor(_url: string, _logger: wfbase.Logger, _dontthrow?: boolean);
        public read(track: string, accept: string): Q.Promise<wfbase.Msg>;
        public exec(track: string, message: wfbase.Msg, accept?: string): Q.Promise<wfbase.Msg>;
        public replace(track: string, message: wfbase.Msg, accept?: string): Q.Promise<wfbase.Msg>;
        public remove(track: string, accept: string): Q.Promise<wfbase.Msg>;
    }
    export class HttpResourceFactory implements wfbase.ResourceFactory {
        private _logger;
        private _dontthrow;
        constructor(_logger: wfbase.Logger, _dontthrow?: boolean);
        public create(url: string, user: string, pw: string): wfbase.Resource;
    }
    export class HttpServer {
        public server: http.Server;
        public handlers: wfbase.Handler[];
        constructor(port: number, authn: wfbase.Authenticate, errorLog: wfbase.Logger);
        public close(): void;
        public add(handler: wfbase.Handler): void;
    }
    export function memoryStream(buffer: NodeBuffer): stream.ReadableStream;
    export function pullStream(is: stream.ReadableStream): Q.Promise<NodeBuffer>;
    export class StreamMsg extends wfbase.BaseMsg {
        private _is;
        constructor(statusCode: number, headers: any, _is: stream.ReadableStream);
        public respond(res: wfbase.Response): Q.Promise<wfbase.Msg>;
        public getBuffer(): Q.Promise<NodeBuffer>;
    }
}