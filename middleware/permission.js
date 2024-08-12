const { Group } = require('@/models/group')
const ResponseResult = require("../models/ResponseResult")
const HttpCodeEnum = require('@/enum/HttpCodeEnum')
const redisClient = require('@/config/redis')
const ObjectId = require('mongoose').Types.ObjectId 

//#region 用户
// 用户本人验证
const AuthByUserId = async(req, res, next)=>{
    // 获取token
    let token = req.headers.token
    
    if(token && token.trim().length > 0){
        // 获取userId
        let userId = await redisClient.get('token:'+token)
        // userId一致则放行
        if(userId && userId == req.body.userId){
            return next()
        }
    }
    return ResponseResult.errorResult(res, HttpCodeEnum.NEED_LOGIN)
}

// 群成员权限验证
const CheckMembershipByGroupId = async(req, res, next)=>{
    // 获取token
    let token = req.headers.token
    
    if(token && token.trim().length > 0){
        // 获取userId
        let userId = await redisClient.get('token:'+token)
        if(userId){
            let match = await new Promise((resolve, reject)=>{
                Group.findOne({_id:req.body.groupId}).exec().then((group)=>{
                    if(!group) reject(HttpCodeEnum.TARGET_NOT_EXIST)
                    // 用户为群组成员
                    if(group?.members.indexOf(new ObjectId(userId)) != -1){
                        resolve(true)
                    }else{
                        reject(HttpCodeEnum.INVALID_OPERATE)
                    }
                })
            })
            if(match) return next()
        }
    }
    return ResponseResult.errorResult(res, HttpCodeEnum.NEED_LOGIN)
}

// 群主权限验证
const CheckOwnershipByGroupId =  async(req, res, next)=>{
    // 获取token
    let token = req.headers.token
    if(token && token.trim().length > 0){
        // 获取userId
        let userId = await redisClient.get('token:'+token)
        if(userId){
            let match = await new Promise((resolve, _)=>{
                Group.findOne({_id: new ObjectId(req.body.groupId)}).exec().then((group)=>{
                    if(group && userId == group.owner){
                        resolve(true)
                    }
                    resolve(false)
                })
            })
            if(match){
                return next()
            }
        }else{
            return ResponseResult.errorResult(res, HttpCodeEnum.NEED_LOGIN)
        }
    }
    return ResponseResult.errorResult(res, HttpCodeEnum.NEED_LOGIN)
}
//#endregion

module.exports = { AuthByUserId, CheckMembershipByGroupId,CheckOwnershipByGroupId }