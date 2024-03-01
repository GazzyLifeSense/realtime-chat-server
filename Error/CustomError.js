
module.exports = class CustomError extends Error{
    res
    httpCodeEnum
    message
    
    constructor(res, httpCodeEnum, message){
        super();
        this.res = res
        this.httpCodeEnum = httpCodeEnum;
        this.message = message
    }

}