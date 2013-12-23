declare module 'webframe-server' {
    import http = require('http');
    export class FileHandler extends Handler {
        private _basepath;
        private _virtualroot;
        private _logger;
        constructor(_basepath: string, _virtualroot: string, _logger: Logger);
        public identified(uri: url.Url): boolean;
        public read(uri: url.Url, user: string, reqId: string, accept: string): Q.Promise<Msg>;
    }
    export class FileResource extends Resource {
        private _filepath;
        private _logger;
        private _autocreate;
        private _md5tasks;
        private _md5;
        constructor(_filepath: string, _logger: Logger, _autocreate?: boolean);
        public md5(): Q.Promise<NodeBuffer>;
        public exists(): Q.Promise<boolean>;
        public read(track: string, accept: string): Q.Promise<Msg>;
        public replace(track: string, rep: Msg): Q.Promise<Msg>;
        private _replace(track, rep);
        public exec(track: string, rep: Msg, accept?: string): Q.Promise<Msg>;
    }
    export class HttpResource extends Resource {
        private _url;
        private _logger;
        private _dontthrow;
        constructor(_url: string, _logger: Logger, _dontthrow?: boolean);
        public read(track: string, accept: string): Q.Promise<Msg>;
        public exec(track: string, message: Msg, accept?: string): Q.Promise<Msg>;
        public replace(track: string, message: Msg, accept?: string): Q.Promise<Msg>;
        public remove(track: string, accept: string): Q.Promise<Msg>;
    }
    export class HttpResourceFactory implements ResourceFactory {
        private _logger;
        private _dontthrow;
        constructor(_logger: Logger, _dontthrow?: boolean);
        public create(url: string, user: string, pw: string): Resource;
    }
    export class HttpServer {
        public server: http.Server;
        public handlers: Handler[];
        constructor(port: number, authn: Authenticate, errorLog: Logger);
        public close(): void;
        public add(handler: Handler): void;
    }
    export function memoryStream(buffer: NodeBuffer): stream.ReadableStream;
    export function pullStream(is: stream.ReadableStream): Q.Promise<NodeBuffer>;
    export class StreamMsg extends BaseMsg {
        private _is;
        constructor(statusCode: number, headers: any, _is: stream.ReadableStream);
        public respond(res: Response): Q.Promise<Msg>;
        public getBuffer(): Q.Promise<NodeBuffer>;
    }
}