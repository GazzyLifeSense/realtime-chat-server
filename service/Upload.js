const SystemError = require("../Error/SystemError")
const HttpCodeEnum = require("../enum/HttpCodeEnum")
const ResponseResult = require("../models/ResponseResult")
const { Group } = require("../models/group")
const { User } = require("../models/user")
const fs = require('fs')
const redisClient = require("../config/redis")

// 上传图片
exports.uploadImg = (_id, filename, filetype, file, uploadType, res)=>{
    // 图片类型检查
    if(!/image/.test(filetype)) return ResponseResult.errorResult(res, HttpCodeEnum.FILETYPE_NOT_ALLOW)
   
    //上传目录获取
    let uploadDir = {0: process.env['AVATAR_PATH'], 1: process.env['GROUP_AVATAR_PATH'], 2: process.env['GROUP_BANNER_PATH']}
    uploadDir = uploadDir[uploadType]

    // 命名格式
    filename = _id + filename.slice(filename.lastIndexOf('.')) 

    // 获取图片二进制流
    file = file.replace(/^data:image\/\w+;base64,/,"")
    const buffer = Buffer.from(file, 'base64')
    
    // 保存图片
    fs.writeFile(uploadDir+filename, buffer, (err, data)=>{
        if(err) throw new SystemError(res, err)
        // 用户头像上传
        if(uploadType == 0){
            User.updateOne({_id},{$set:{avatar:filename}}).exec((err, user)=>{
                if(err) throw new SystemError(res, err)
                redisClient.del('user:'+_id)
                ResponseResult.okResult(res,HttpCodeEnum.SUCCESS, filename)
            })
        }
        // 群组头像上传
        else if(uploadType == 1){
            Group.updateOne({_id},{ $set:{avatar:filename}}).exec((err, result)=>{
                if(err) throw new SystemError(res, err)
                ResponseResult.okResult(res,HttpCodeEnum.SUCCESS, filename)
            })
        // 群组横幅上传
        }else if(uploadType == 2){
            Group.updateOne({_id},{ $set:{banner:filename}}).exec((err, result)=>{
                if(err) throw new SystemError(res, err)
                ResponseResult.okResult(res,HttpCodeEnum.SUCCESS, filename)
            })
        }
    })
}