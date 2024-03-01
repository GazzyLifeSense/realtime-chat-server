

export = class SocketResponseResult<T>{
    code: Number;
    msg: String;
    data: T;

    constructor(socketCodeEnum, data?){
        this.code = socketCodeEnum.code;
        this.msg = socketCodeEnum.msg;
        this.data = data;
    }

}