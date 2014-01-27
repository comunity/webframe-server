/// <reference path="../typed/node/node.d.ts" />
import stream = require('stream');
declare function memoryStream(buffer: NodeBuffer): stream.ReadableStream;
export = memoryStream;
