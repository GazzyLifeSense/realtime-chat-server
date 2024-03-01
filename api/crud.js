let ObjectId = require('mongoose').Types.ObjectId 
let { User } = require('../models/user')
const { Chat } = require('../models/chat')
const { Group } = require('../models/group')
const { ApplyFriend } = require('../models/applyFriend')
const { ApplyGroup } = require('../models/applyGroup')
const bcrypt = require('bcryptjs')
const getLocation = require('../util/location')
let fs = require('fs')

let ResponseResult = require("../models/ResponseResult.js")
let SocketResponseResult = require("../models/SocketResponseResult")
let HttpCodeEnum = require("../enum/HttpCodeEnum")
let socketCodeEnum = require("../enum/SocketCodeEnum")
const SystemError = require("../Error/SystemError")
const jwtUtil = require('../util/jwtUtil')
const redisClient = require('../config/redisConfig')
const CustomError = require('../Error/CustomError')

class CRUD{
    // 注册
    register(obj, req, res){
        User.findOne({username: obj.username}, async(err, user)=>{
            if(err) throw new SystemError(res)
            // 用户名已存在
            if(user) return ResponseResult.errorResult(res, HttpCodeEnum.USERNAME_EXIST)

            // BCrypt算法加密
            obj.password = await new Promise((resolve, reject) => {
                bcrypt.hash(obj.password, 8, (err, hash)=>{
                    if(err) reject(err)
                    resolve(hash)
                })
            });
            // 注册时间
            obj.regDate = Date.now()

            // 归属地
            obj.location = getLocation(req)

            // 创建新用户
            User.create(obj, (err, _)=>{
                if(err) throw new SystemError(res)
                return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
            })
        })
    }
    
    // 登录
    login(obj, req, res){
        User.findOne({username: obj.username}).exec(async (err, user)=>{
            if(err) throw new SystemError(res)
            // 验证失败
            if(!user) {
                return ResponseResult.errorResult(res, HttpCodeEnum.LOGIN_ERROR)
            }

            // BCrypt算法匹配
            let match = await bcrypt.compare(obj.password, user.password)
            if(!match) {
                return ResponseResult.errorResult(res, HttpCodeEnum.LOGIN_ERROR)
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
            redisClient.set(token,user._id.toString()).then(()=>{
                redisClient.expire(token, 3600)
            }).catch((err)=>{
                throw new SystemError(res)
            })
            
            // 保存用户信息
            redisClient.set('jormun:' + user._id.toString(), JSON.stringify(user)).catch((err)=>{
                throw new SystemError(res)
            })

            return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, token)
            
        })
    }

    async adminLogin(obj, res){

        // 验证用户名及密码
        if(obj.username != 'Jormun') {
            return ResponseResult.errorResult(res, HttpCodeEnum.LOGIN_ERROR)
        }
        if(obj.password != 'numroJ'){
            return ResponseResult.errorResult(res, HttpCodeEnum.LOGIN_ERROR)
        }

        // 签发token
        let token = await jwtUtil.signToken('Jormun',1)
        
        return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, token)
        
    }

    // 发送好友申请请求
    applyFriend(from, to, res, server){
        User.findOne({username: to},(err, user)=>{
            if(err) throw new SystemError(res)
            // 被申请人不存在
            if(!user) return ResponseResult.errorResult(res, HttpCodeEnum.USER_NOT_EXIST)
            // 申请人与被申请人相同
            if(user._id == from) return ResponseResult.errorResult(res, HttpCodeEnum.CANT_DO_THIS_FOR_YOURSELF)
            // 申请人与被申请人非好友
            if(user.friends.indexOf(from) === -1)
                // 发送申请
                ApplyFriend.findOne({from, to: user._id},(err,apply)=>{
                    if(err) throw new SystemError(res)
                    // 已发送过申请
                    if(apply) return ResponseResult.errorResult(res, HttpCodeEnum.DONT_DO_THIS_TWICE)
                    new ApplyFriend({from, to: user._id}).save((err,apply)=>{
                        if(err) throw new SystemError(res)
                        // 提示申请人与被申请人
                        server.emit(user._id, new SocketResponseResult(socketCodeEnum.NEW_APPLY))
                        return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
                    })
                })
            else return ResponseResult.errorResult(res, HttpCodeEnum.DONT_DO_THIS_TWICE)
        })
    }
    
    // 是否好友
    async isFriend(from, to){
        var v = await new Promise((resolve, reject) => {
            User.findOne({_id:to}, (err, todata)=>{
                if(err) resolve('error')

                if(todata.friends.indexOf(from) === -1)
                    resolve(false)
                resolve(true)
            })
        })
        return v        
    }

    // 添加好友
    addFriend(from, to, res, server){
        // 申请人与被申请人相同
        if(from == to) return ResponseResult.errorResult(res, HttpCodeEnum.DONT_ADD_YOURSELF)
        User.findOne({_id:to}, (err, todata)=>{
            if(err) throw new SystemError(res)
            // 被申请人不存在
            if(!todata) return ResponseResult.errorResult(res, HttpCodeEnum.User_NOT_EXIST)
            // 申请人与被申请人非好友
            if(todata.friends.indexOf(from) === -1)
                todata.friends.push(from)
            else return ResponseResult.errorResult(res, HttpCodeEnum.DONT_ADD_TWICE)
            todata.save((err,data)=>{
                if(err) throw new SystemError(res)
                User.findOne({_id:from}, (err, fromdata)=>{
                    if(err) throw new SystemError(res)
                    // 申请人不存在
                    if(!fromdata) return ResponseResult.errorResult(res, HttpCodeEnum.User_NOT_EXIST)
                    // 申请人与被申请人非好友
                    if(fromdata.friends.indexOf(to) === -1)
                        fromdata.friends.push(to)
                    fromdata.save((err,data)=>{
                        if(err) throw new SystemError(res)
                        server.emit(from, new SocketResponseResult(socketCodeEnum.NEW_FRIEND))
                        // 删除申请记录
                        ApplyFriend.remove({from,to},(err,result)=>{
                            if(err) throw new SystemError(res)
                            return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
                        })
                    })
                })
            })
        })
    }

    // 双向删除
    deleteFriend(from, to, res){
        // 不能自己删除自己
        if(from == to) throw new CustomError(res, HttpCodeEnum.CANT_DO_THIS_FOR_YOURSELF)
        
        // 查找对方的用户
        User.findOne({_id:to}, (err, todata)=>{
            if(err) throw new SystemError(res)
            if(!todata) throw new CustomError(err, HttpCodeEnum.User_NOT_EXIST)
            // 从对方好友列表移除自己
            if(todata.friends.indexOf(from) !== -1)
                todata.friends.remove(from)
            else throw new CustomError(err, HttpCodeEnum.DONT_DO_THIS_TWICE)
            // 保存
            todata.save((err,data)=>{
                if(err) throw new SystemError(res)
                // 查找自己的用户
                User.findOne({_id:from}, (err, fromdata)=>{
                    if(err) throw new SystemError(res)
                    if(!fromdata) throw new CustomError(err, HttpCodeEnum.User_NOT_EXIST)
                    // 将对方从自己的好友列表移除
                    if(fromdata.friends.indexOf(to) !== -1)
                        fromdata.friends.remove(to)
                    // 保存
                    fromdata.save((err,data)=>{
                        if(err) throw new SystemError(res)
                        return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
                    })
                })
            })
        })
    }

    // 获取好友列表
    getFriends(_id, res){
        User.findOne({_id}).select('friends').exec((err,user)=>{
            if(err)  throw new SystemError(res)
            User.find({_id: user.friends}).select(['_id', 'username', 'nickname', 'avatar', 'intro']).exec((err,friend)=>{
                if(err)  throw new SystemError(res)
                return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, friend)
            })
        })
    }

    // 查询是否有待处理申请
    hasApplies(_id, res){
        ApplyFriend.count({to:_id}).exec((err, count)=>{
            if(err) throw new SystemError(res)
            ApplyGroup.count({owner:_id}).exec((err, total)=>{
                if(err) throw new SystemError(res)
                return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, total+count)
            })
        })
        
    }
    getFriendApplies(_id, res){
        User.aggregate([
            {
                $lookup:{
                    from: 'applyfriends',
                    localField: '_id',
                    foreignField: 'from',
                    as: 'applyFrom'
                },
            },
            {
                $match: { 'applyFrom.to': ObjectId(_id) }
            },
            {
                $project: {
                    password: 0,
                    'applyFrom._id': 0,
                    'applyFrom._v': 0
                }
            }
        ]).exec((err, apply)=>{
            if(err) throw new SystemError(res)
            return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, apply)
        })
    }
    getGroupApplies(_id, res){
        ApplyGroup.aggregate([
            {
                $lookup:{
                    from: 'users',
                    localField: 'from',
                    foreignField: '_id',
                    as: 'applyFrom'
                }
            },
            {
                $lookup:{
                    from: 'groups',
                    localField: 'to',
                    foreignField: '_id',
                    as: 'groupDetail'
                }
            },
            {
                $match: { 'groupDetail.owner': ObjectId(_id)}
            },
            {
                $project: {
                    password: 0,
                    '_v': 0,
                    'applyFrom.password': 0,
                    'applyFrom.friends': 0,
                    'applyFrom._v': 0,
                    'groupDetail.members': 0,
                    'groupDetail._v': 0
                }
            }
        ]).exec((err, apply)=>{
            if(err) throw new SystemError(res)
            return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, apply)
        })
    }
    removeApply(from,to,type,res){
        if(type === 'friend'){
            ApplyFriend.remove({from, to}).exec((err)=>{
                if(err) throw new SystemError(res)
                return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
            })
        }else if(type === 'group'){
            ApplyGroup.remove({from, to}).exec((err)=>{
                if(err) throw new SystemError(res)
                return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
            })
        }
    }
    // 获取从 fromId 发到 toId 的信息
    getHistoryMsgs(from, to, type, size, time, res){
        let pageSize,before
        // 默认返回信息条数
        if(size) pageSize = size
        else pageSize = 10 
        // 用于获取更早信息
        if(time) before = time
        else before = Number.POSITIVE_INFINITY

        if(type === 'private'){
            
            Chat.find({$or:[{from, to},{from: to, to: from}],'create_time':{$lt:before}}).sort({'create_time':-1}).limit(pageSize).exec((err, msg)=>{
                if(err) throw new SystemError(res)
                return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, msg.reverse())
            })
        }
        else if(type === 'group'){
            Chat.find({to: from, 'create_time':{$lt:before}}).sort({'create_time':-1}).limit(pageSize).exec((err, msg)=>{
                if(err) throw new SystemError(res)
                return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, msg.reverse())
            })
        }
    }


    // 创建群组
    createGroup(groupInfo, res){
        Group.create(groupInfo, (err, data)=>{
            if(err) throw new SystemError(res)
            return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, data)
        })
    }

    // 获取群组列表
    getGroups(_id, res){
        Group.find({members: _id }).exec((err, group)=>{
            if(err) throw new SystemError(res)
            return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, group)
        })
    }
    // 根据群组名获取群组列表
    getGroupsByName(name, res){
        Group.find({ name: {$regex: '.*'+name+'.*'} }).exec((err, group)=>{
            if(err) throw new SystemError(res)
            return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, group)
        })
    }
    // 申请加入群组
    applyGroup(from, to, res, server){
        Group.findOne({_id: to},(err, group)=>{
            if(err) throw new SystemError(res)
            if(!group) return ResponseResult.errorResult(res, HttpCodeEnum.GROUP_NOT_EXIST)
            if(group.owner == from) return ResponseResult.errorResult(res, HttpCodeEnum.ALREADY_BEEN_OWNER)
            if(group.members.indexOf(from) === -1)
                ApplyGroup.findOne({from, to, owner: group.owner},(err,apply)=>{
                    if(err) throw new SystemError(res)
                    if(apply) return ResponseResult.errorResult(res, HttpCodeEnum.DONT_DO_THIS_TWICE)
                    new ApplyGroup({from, to, owner: group.owner}).save((err,apply)=>{
                        if(err) throw new SystemError(res)
                        server.emit(group.owner, new SocketResponseResult(socketCodeEnum.NEW_APPLY))
                        return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
                    })
                })
            else throw new CustomError(res, HttpCodeEnum.DONT_DO_THIS_TWICE)
        })
    }

    // 是否成员
    async isMember(from, to){
        var v = await new Promise((resolve, reject) => {
            Group.findOne({_id:to}, (err, todata)=>{
                if(err) resolve('error')

                if(todata.members.indexOf(from) === -1)
                    resolve(false)
                resolve(true)     
            })
        })
        return v        
    }

    // 获取成员列表
    getMembers(groupId, res){
        Group.findOne({_id:groupId}).exec((err,group)=>{
            if(err) throw new SystemError(res)
            User.find({_id:group.members}).select(['_id','username','nickname','avatar']).exec((err, member)=>{
                if(err) throw new SystemError(res)
                return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, member)
            })
        })
    }

    // 移除成员
    removeMember(groupId, _id, res){
        Group.findOne({_id:groupId}).exec((err,group)=>{
            if(err) throw new SystemError(res)
            if(!group) return ResponseResult.errorResult(res, HttpCodeEnum.GROUP_NOT_EXIST)
            group.members.splice(group.members.indexOf(ObjectId(_id)),1)
            group.save((err, _)=>{
                if(err) throw new SystemError(res)
                return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
            })
        })
    }

    // 加入群组
    addGroup(from, to, res, server){
        Group.findOne({_id: to}).exec((err, group)=>{
            if(err) throw new SystemError(res)
            if(!group) throw new CustomError(res, HttpCodeEnum.GROUP_NOT_EXIST)
            if(group.members.indexOf(from) !== -1) throw new CustomError(res, HttpCodeEnum.OBJECT_ALREADY_IN_GROUP)
            group.members.push(from)
            group.save((err, data)=>{
                if(err) throw new SystemError(res)
                server.emit(from, new SocketResponseResult(socketCodeEnum.NEW_GROUP))
                // 删除申请记录
                ApplyGroup.remove({from,to},(err,result)=>{
                    if(err) throw new SystemError(res)
                    return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
                })
            })
        })
    }

    // 退出群聊
    exitGroup(groupId, _id, res){
        Group.findOne({_id:groupId}).exec((err,group)=>{
            if(err) throw new SystemError(res)
            if(!group) return ResponseResult.errorResult(res, HttpCodeEnum.GROUP_NOT_EXIST)
            group.members.splice(group.members.indexOf(ObjectId(_id)),1)
            group.save((err, _)=>{
                if(err) throw new SystemError(res)
                return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
            })
        })
    }

    // 解散群聊
    dismissGroup(groupId, _id, res){
        Group.findOneAndRemove({_id:groupId}).exec((err,result)=>{
            if(err) throw new SystemError(res)
            if(!result) return ResponseResult.errorResult(res, HttpCodeEnum.GROUP_NOT_EXIST)
            return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
        })
    }

    async verifyAndGetUser(res, token){
        console.log('token:', token)
        // 获取userId
        let userId = await jwtUtil.verifyToken(res, token)
        // 从redis获取用户信息
        let user = await redisClient.get('jormun:'+userId)
        // 如果redis中不存在该用户信息则存储到redis并返回
        if(!user){
            User.findOne({_id:userId}).exec(async (err, user)=>{
                if(err) throw new SystemError(res)
                await redisClient.set("jormun:"+userId, JSON.stringify(user))
                // 不返回密码
                user.password = null
                ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, user)
            })
        }else{
            ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, JSON.parse(user))
        }
        
    }

    uploadImg(_id, filename, filetype, file, uploadType, res){
        if(!/image/.test(filetype)) return ResponseResult.errorResult(res, HttpCodeEnum.FILETYPE_NOT_ALLOW)
        let uploadDir = {0: process.env['AVATAR_PATH'], 1: process.env['GROUP_AVATAR_PATH'], 2: process.env['GROUP_BANNER_PATH']}
        uploadDir = uploadDir[uploadType]

        // 命名格式
        filename = _id + filename.slice(filename.lastIndexOf('.')) 
        // 获取图片二进制流
        file = file.replace(/^data:image\/\w+;base64,/,"")
        const buffer = Buffer.from(file, 'base64')
        // 保存图片
        fs.writeFile(uploadDir+filename, buffer, (err, data)=>{
            if(err) throw new SystemError(res)
            // 用户头像上传
            if(uploadType == 0){
                User.updateOne({_id},{$set:{avatar:filename}}).exec((err, user)=>{
                    if(err) throw new SystemError(res)
                    ResponseResult.okResult(res,HttpCodeEnum.SUCCESS, filename)
                })
            }
            // 群组头像上传
            else if(uploadType == 1){
                Group.updateOne({_id},{ $set:{avatar:filename}}).exec((err, user)=>{
                    if(err) throw new SystemError(res)
                    ResponseResult.okResult(res,HttpCodeEnum.SUCCESS, filename)
                })
            // 群组横幅上传
            }else if(uploadType == 2){
                Group.updateOne({_id},{ $set:{banner:filename}}).exec((err, user)=>{
                    if(err) throw new SystemError(res)
                    ResponseResult.okResult(res,HttpCodeEnum.SUCCESS, filename)
                })
            }
        })
    }

    uploadGroupAvatar(_id, filename, filetype, file, res){
        if(!/image/.test(filetype)) return ResponseResult.errorResult(res, HttpCodeEnum.FILETYPE_NOT_ALLOW)
        let uploadDir = process.env['AVATAR_PATH']
        filename = _id + filename.slice(filename.lastIndexOf('.')) 
        file = file.replace(/^data:image\/\w+;base64,/,"")
        const buffer = Buffer.from(file, 'base64')
        fs.writeFile(uploadDir+filename, buffer, (err, data)=>{
            if(err) throw new SystemError(res)
            User.updateOne({_id},{$set:{avatar:filename}}).exec((err, user)=>{
                if(err) throw new SystemError(res)
                ResponseResult.okResult(res,HttpCodeEnum.SUCCESS, filename)
            })
        })
    }

    uploadGroupBanner(_id, filename, filetype, file, res){
        if(!/image/.test(filetype)) return ResponseResult.errorResult(res, HttpCodeEnum.FILETYPE_NOT_ALLOW)
        let uploadDir = process.env['AVATAR_PATH']
        filename = _id + filename.slice(filename.lastIndexOf('.')) 
        file = file.replace(/^data:image\/\w+;base64,/,"")
        const buffer = Buffer.from(file, 'base64')
        fs.writeFile(uploadDir+filename, buffer, (err, data)=>{
            if(err) throw new SystemError(res)
            User.updateOne({_id},{$set:{avatar:filename}}).exec((err, user)=>{
                if(err) throw new SystemError(res)
                ResponseResult.okResult(res,HttpCodeEnum.SUCCESS, filename)
            })
        })
    }
}

module.exports = new CRUD()