import FileHandler = require('./FileHandler')
import FileResource = require('./FileResource')
import HttpResource = require('./HttpResource')
import HttpResourceFactory = require('./HttpResourceFactory')
import HttpServer = require('./HttpServer')
import memoryStream = require('./memoryStream')
import pullStream = require('./pullStream')
import StreamMsg = require('./StreamMsg')

var o = {
    FileHandler: FileHandler,
    FileResource: FileResource,
    HttpResource: HttpResource,
    HttpResourceFactory: HttpResourceFactory,
    HttpServer: HttpServer,
    memoryStream: memoryStream,
    pullStream: pullStream,
    StreamMsg: StreamMsg
}

export = o