"use strict";
module.exports = /** @class */ (function () {
    function SocketResponseResult(socketCodeEnum, data) {
        this.code = socketCodeEnum.code;
        this.msg = socketCodeEnum.msg;
        this.data = data;
    }
    return SocketResponseResult;
}());
