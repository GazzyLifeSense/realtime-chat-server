"use strict";
var _a;
module.exports = (_a = /** @class */ (function () {
        function ResponseResult(httpCodeEnum, data) {
            this.code = httpCodeEnum.code;
            this.msg = httpCodeEnum.msg;
            this.data = data;
        }
        return ResponseResult;
    }()),
    _a.okResult = function (res, httpCodeEnum, data) {
        res.json(new _a(httpCodeEnum, data));
    },
    _a.errorResult = function (res, httpCodeEnum, data) {
        res.json(new _a(httpCodeEnum, data));
    },
    _a);
