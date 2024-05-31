const SystemError = require("../Error/SystemError")
const HttpCodeEnum = require("../enum/HttpCodeEnum")
const SocketCodeEnum = require("../enum/SocketCodeEnum")
const ResponseResult = require("../models/ResponseResult")
const SocketResponseResult = require("../models/SocketResponseResult")
const { ApplyFriend } = require("../models/applyFriend")
const { User } = require("../models/user")
const ObjectId = require('mongoose').Types.ObjectId 

// 获取好友列表
exports.getFriends = (userId, res)=>{
    User.findOne({_id:userId}).select('friends').exec().then((user)=>{
        User.find({_id: user.friends}).select(['_id', 'username', 'nickname', 'avatar', 'introduction', 'location', 'regDate']).exec().then((friend)=>{ 
            return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, friend)
        })
    })
}

// 是否好友
exports.isFriend = async(from, to)=>{
    var v = await new Promise((resolve, reject) => {
        User.findOne({_id:to}).then((todata)=>{
            if(!todata) resolve('error')

            if(todata.friends.indexOf(from) === -1)
                resolve(false)
            resolve(true)
        })
    })
    return v        
}

// 添加好友
exports.addFriend = (from, to, res, server)=>{
    // 申请人与被申请人相同
    if(from == to) return ResponseResult.errorResult(res, HttpCodeEnum.DONT_ADD_YOURSELF)
    User.findOne({_id:to}).then((todata)=>{
        // 被申请人不存在
        if(!todata) return ResponseResult.errorResult(res, HttpCodeEnum.TARGET_NOT_EXIST)
        // 申请人与被申请人非好友
        if(todata.friends.indexOf(from) === -1)
            todata.friends.push(from)
        else return ResponseResult.errorResult(res, HttpCodeEnum.DONT_ADD_TWICE)
        todata.save().then(()=>{
            User.findOne({_id:from}).then((fromdata)=>{
                // 申请人不存在
                if(!fromdata) return ResponseResult.errorResult(res, HttpCodeEnum.TARGET_NOT_EXIST)
                // 申请人与被申请人非好友
                if(fromdata.friends.indexOf(to) === -1)
                    fromdata.friends.push(to)
                fromdata.save().then(()=>{
                    server.to(from).emit(from, new SocketResponseResult(SocketCodeEnum.NEW_FRIEND))
                    // 删除申请记录
                    ApplyFriend.deleteOne({from,to}).then(()=>{
                        return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
                    })
                })
            })
        })
    })
}

// 双向删除
exports.deleteFriend = (from, to, res)=>{
    // 不能自己删除自己
    if(from == to) return ResponseResult.errorResult(res, HttpCodeEnum.CANT_DO_THIS_FOR_YOURSELF)
    
    // 查找对方的用户
    User.findOne({_id:to}).then((todata)=>{
     
        if(!todata) return ResponseResult.errorResult(res, HttpCodeEnum.TARGET_NOT_EXIST)
        // 从对方好友列表移除自己
        todata.friends.remove(new ObjectId(from))
        // 保存
        todata.save().then(()=>{
            // 查找自己的用户
            User.findOne({_id:from}, (fromdata)=>{
                if(!fromdata) return ResponseResult.errorResult(res, HttpCodeEnum.TARGET_NOT_EXIST)
                // 将对方从自己的好友列表移除
                fromdata.friends.remove(new ObjectId(to))
                // 保存
                fromdata.save().then(()=>{
                    return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
                })
            })
        })
    })
}