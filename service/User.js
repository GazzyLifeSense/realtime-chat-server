const SystemError = require("../Error/SystemError");
const redisClient = require("../config/redis");
const HttpCodeEnum = require("../enum/HttpCodeEnum");
const ResponseResult = require("../models/ResponseResult");
const { User } = require("../models/user");
const jwtUtil = require("../util/jwtUtil");
const bcrypt = require('bcryptjs')
const getLocation = require('../util/location');
const { TARGET_NOT_EXIST } = require("../enum/HttpCodeEnum");

// 注册
exports.register = (username, password, nickname, req, res)=>{
    User.findOne({username}).then(async(user)=>{
        // 用户名已存在
        if(user) return ResponseResult.errorResult(res, HttpCodeEnum.USERNAME_EXIST)

        // BCrypt算法加密
        password = await new Promise((resolve, reject) => {
            bcrypt.hash(password, 8, (err, hash)=>{
                if(err) reject(err)
                resolve(hash)
            })
        })

        // 归属地
        let location = await getLocation(req)

        // 创建新用户
        User.create({username, password, nickname, location}).then(()=>{
            return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
        })
    })
}

// 登录
exports.login = (username, password, req, res)=>{
    User.findOne({ username }).exec().then(async user => {
        // 验证失败
        if(!user) {
            return ResponseResult.errorResult(res, HttpCodeEnum.LOGIN_ERROR)
        }

        // BCrypt算法匹配
        let match = await bcrypt.compare(password, user.password)
        if(!match) {
            return ResponseResult.errorResult(res, HttpCodeEnum.LOGIN_ERROR)
        }

        // 账号状态
        if(user.isBanned){
            return ResponseResult.errorResult(res, HttpCodeEnum.BAN)
        }

        // 签发token
        let token = await jwtUtil.signToken(user._id.toString(), 1)
        
        // 归属地
        let location = await getLocation(req)
        if(location != user.location){
            user.location = location
        }

        // 将用户信息存入redis
        user.password = undefined
        
        // 保存token
        redisClient.set('token:'+token,user._id.toString()).then(()=>{
            redisClient.expire('token:'+token, 3600)
        }).catch((err)=>{
            throw new SystemError(res, err)
        })
        
        // 保存用户信息
        redisClient.set('user:'+user._id.toString(), JSON.stringify(user)).then(()=>{
            redisClient.expire('user:'+user._id.toString(), 3600)
        }).catch((err)=>{
            throw new SystemError(res, err)
        })

        return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, token)
        
    })
}

// 管理员登录
exports.adminLogin = async(username, password, res)=>{

    // 验证用户名及密码
    if(username != 'Jormun') {
        return ResponseResult.errorResult(res, HttpCodeEnum.LOGIN_ERROR)
    }
    if(password != 'numroJ'){
        return ResponseResult.errorResult(res, HttpCodeEnum.LOGIN_ERROR)
    }

    // 签发token
    let token = await jwtUtil.signToken(username,1)
    
    return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, token)
    
}

// 验证token并获取userId
exports.verifyAndGetUser = async(res, token)=>{
    console.log('token:', token)
    // 获取userId
    let userId = await jwtUtil.verifyToken(res, token)
    // 从redis获取用户信息并返回
    let user = await redisClient.get('user:'+userId)
    // 如果redis中不存在该用户信息则存储到redis并返回
    if(!user){
        User.findOne({_id:userId}).exec().then(async user => {
            // 是否存在
            if(!user) return ResponseResult.errorResult(res, HttpCodeEnum.TARGET_NOT_EXIST)
            
            // 是否封禁
            if(user.isBanned) return ResponseResult.errorResult(res, HttpCodeEnum.BAN)
            
            // 存储至redis
            redisClient.set('user:'+userId, JSON.stringify(user)).then(()=>{
                redisClient.expire('user:'+userId, 3600)
            })

            // 不返回密码
            user.password = undefined
            ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, user)
        })
    }else{
        ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, JSON.parse(user))
    }
    
}

// 修改昵称 
exports.updateNickname = async(userId, nickname, res)=>{
    User.updateOne({_id:userId},{$set:{nickname}}).exec().then(async(result)=>{
        // 未修改
        if(!result || result.modifiedCount == 0){
            return ResponseResult.errorResult(res, HttpCodeEnum.NOT_MODIFIED)
        }

        // 删除缓存
        await redisClient.del('user:'+userId)
        return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, nickname)
    })
}

// 修改个人介绍
exports.updateIntroduction = async(userId, introduction, res)=>{
    User.updateOne({_id:userId},{$set:{introduction}}).exec().then(async(result)=>{
        // 未修改
        if(!result || result.modifiedCount == 0){
            return ResponseResult.errorResult(res, HttpCodeEnum.NOT_MODIFIED)
        }

        // 删除缓存
        redisClient.del('user:'+userId)
        return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, introduction)
    })
}

// 修改密码 
exports.updatePassword = async(userId, password, newPassword, res)=>{
    User.findOne({_id:userId}).exec().then(async(user)=>{
        // 是否存在
        if(!user) return ResponseResult.errorResult(res, TARGET_NOT_EXIST)

        // BCrypt算法匹配
        let match = await bcrypt.compare(password, user.password)
        if(!match) {
            return ResponseResult.errorResult(res, HttpCodeEnum.LOGIN_ERROR)
        }
        // 修改密码
        user.password =  await new Promise((resolve, reject) => {
            bcrypt.hash(newPassword, 8, (err, hash)=>{
                if(err) reject(err)
                resolve(hash)
            })
        }).catch((err)=>{
            throw new SystemError(res, err)
        });

        // 保存到数据库
        user.save().then(()=>{
            return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
        })
    })
}