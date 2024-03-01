
export = class ResponseResult<T>{
    code: Number; // 响应码
    msg: String; // 响应消息
    data: T; // 响应数据

    constructor(httpCodeEnum, data?){
        this.code = httpCodeEnum.code;
        this.msg = httpCodeEnum.msg;
        this.data = data;
    }

    // 操作成功
    static okResult = (res, httpCodeEnum, data?)=>{
        res.json(new ResponseResult(httpCodeEnum, data))
    }

    // 发生错误
    static errorResult = (res, httpCodeEnum, data?)=>{
        res.json(new ResponseResult(httpCodeEnum, data))
    }
}