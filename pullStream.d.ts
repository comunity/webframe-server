/// <reference path="../typed/node/node.d.ts" />
/// <reference path="../typed/q/Q.d.ts" />
import stream = require('stream');
declare function pullStream(is: stream.ReadableStream): Q.Promise<NodeBuffer>;
export = pullStream;
