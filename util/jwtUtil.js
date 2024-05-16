const jwt = require('jsonwebtoken')
const CustomError = require('../Error/CustomError')
const HttpCodeEnum = require('../enum/HttpCodeEnum')

module.exports = class jwtUtil{
    static secret = process.env['JWT_SECRET']
    // 签发token
    static async signToken(data, hours){
        let resToken = await jwt.sign({data}, this.secret, {expiresIn: 3600*hours })
        return resToken
    }
    
    // 解密获得userId
    static async verifyToken(res, token){
        let userId
        await jwt.verify(token, this.secret, (err, decode)=>{
            // token过期或无效
            if(err) throw new CustomError(res, HttpCodeEnum.NEED_LOGIN)
            userId = decode.data
        })
        return userId;
    }
}