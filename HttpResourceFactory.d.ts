/// <reference path="node_modules/webframe-base/index.d.ts" />
import wfbase = require('webframe-base');
declare class HttpResourceFactory implements wfbase.ResourceFactory {
    private _logger;
    private _dontthrow;
    constructor(_logger: wfbase.Logger, _dontthrow?: boolean);
    public create(url: string, user: string, pw: string): wfbase.Resource;
}
export = HttpResourceFactory;
