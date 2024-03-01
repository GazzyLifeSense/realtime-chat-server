const ResponseResult = require('../models/ResponseResult')
const HttpCodeEnum = require("../enum/HttpCodeEnum")
module.exports = class SystemException extends Error{
    res
    httpCodeEnum
    message
    
    constructor(res, err){
        super();
        this.res = res
        this.httpCodeEnum = HttpCodeEnum.SYSTEM_ERROR;
        this.message = err
    }

}