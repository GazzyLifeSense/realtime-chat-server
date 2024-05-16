const ResponseResult = require("../models/ResponseResult")
const SystemError = require("@/Error/SystemError")
const CustomError = require('@/Error/CustomError')

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
                Group.findOne({_id:req.body.groupId}).exec((err, group)=>{
                    if(err) reject(HttpCodeEnum.SYSTEM_ERROR)
                    if(!group) reject(HttpCodeEnum.GROUP_NOT_EXIST)
                    // 用户为群组成员
                    if(group?.members.indexOf(ObjectId(userId)) != -1){
                        resolve(true)
                    }else{
                        reject(HttpCodeEnum.NOT_GROUP_MEMBER)
                    }
                })
            }).catch((err)=>{
                throw new CustomError(res, err)
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
            let match = await new Promise((resolve, reject)=>{
                Group.findOne({_id: ObjectId(req.body.groupId)}).exec((err, group)=>{
                    if(err) throw new SystemError(res, err)
                    if(group && userId == group.owner){
                        resolve(true)
                    }
                    resolve(false)
                })
            }).catch((err)=>{
                throw new SystemError(res, err)
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
