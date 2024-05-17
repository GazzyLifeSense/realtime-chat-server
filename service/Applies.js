const CustomError = require("../Error/CustomError")
const SystemError = require("../Error/SystemError")
const HttpCodeEnum = require("../enum/HttpCodeEnum")
const SocketCodeEnum = require("../enum/SocketCodeEnum")
const ResponseResult = require("../models/ResponseResult")
const SocketResponseResult = require("../models/SocketResponseResult")
const { ApplyFriend } = require("../models/applyFriend")
const { ApplyGroup } = require("../models/applyGroup")
const { Group } = require("../models/group")
const { User } = require("../models/user")
const ObjectId = require('mongoose').Types.ObjectId 

// 查询是否有待处理申请
exports.hasApplies = (_id, res)=>{
    ApplyFriend.countDocuments({to:_id}).exec().then((count)=>{
        ApplyGroup.countDocuments({owner:_id}).exec().then((total)=>{
            return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, total+count)
        })
    })
    
}

// 发送好友申请请求
exports.applyFriend = (from, to, res, server)=>{
    User.findOne({username: to}).then((user)=>{
        // 被申请人不存在
        if(!user) return ResponseResult.errorResult(res, HttpCodeEnum.USER_NOT_EXIST)
        // 申请人与被申请人相同
        if(user._id == from) return ResponseResult.errorResult(res, HttpCodeEnum.CANT_DO_THIS_FOR_YOURSELF)
        // 申请人与被申请人非好友
        if(user.friends.indexOf(from) === -1)
            // 发送申请
            ApplyFriend.findOne({from, to: user._id}).then((apply)=>{
                // 已发送过申请
                if(apply) return ResponseResult.errorResult(res, HttpCodeEnum.DONT_DO_THIS_TWICE)
                new ApplyFriend({from, to: user._id}).save((err,apply)=>{
                    // 提示申请人与被申请人
                    server.emit(user._id, new SocketResponseResult(SocketCodeEnum.NEW_APPLY))
                    return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
                })
            })
        else return ResponseResult.errorResult(res, HttpCodeEnum.ALREADY_BEEN_Friend)
    })
}

// 获取好友申请
exports.getFriendApplies = (_id, res)=>{
    User.aggregate([
        {
            $lookup:{
                from: 'applyfriends',
                localField: '_id',
                foreignField: 'from',
                as: 'apply'
            },
        },
        {
            $unwind: '$apply'
        },
        {
            $match: { 'apply.to': ObjectId(_id) }
        },
        {
            $project: {
                password: 0,
                'apply._id': 0,
                'apply._v': 0,
                friends: 0,
            }
        }
    ]).exec().then((apply)=>{
     
        return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, apply)
    })
}

// 申请加入群组
exports.applyGroup = (from, to, res, server)=>{
    Group.findOne({_id: to}).then((group)=>{
        if(!group) return ResponseResult.errorResult(res, HttpCodeEnum.GROUP_NOT_EXIST)
        if(group.members.indexOf(from) === -1)
            ApplyGroup.findOne({from, to, owner: group.owner}).then((apply)=>{
                if(apply) return ResponseResult.errorResult(res, HttpCodeEnum.DONT_DO_THIS_TWICE)
                new ApplyGroup({from, to, owner: group.owner}).save((err)=>{
                    server.emit(group.owner, new SocketResponseResult(SocketCodeEnum.NEW_APPLY))
                    return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
                })
            })
        else throw new CustomError(res, HttpCodeEnum.ALREADY_BEEN_MEMBER)
    })
}

// 获取群组申请
exports.getGroupApplies = (_id, res)=>{
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
            $unwind: '$applyFrom'
        },
        {
            $unwind: '$groupDetail'
        },
        {
            $project: {
                password: 0,
                '_id': 0,
                '__v': 0,
                'applyFrom.password': 0,
                'applyFrom.friends': 0,
                'applyFrom.__v': 0,
                'groupDetail.members': 0,
                'groupDetail.__v': 0
            }
        }
    ]).exec().then((apply)=>{
        return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, apply)
    })
}

// 移除申请
exports.removeApply = (from, to, type, res, server)=>{
    if(type === 'friend'){
        ApplyFriend.remove({from, to}).exec(()=>{
            server.to(from).emit(from, new SocketResponseResult(SocketCodeEnum.FRIEND_APPLY_REJECT))
            return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
        })
    }else if(type === 'group'){
        ApplyGroup.remove({from, to}).exec(()=>{
            server.to(from).emit(from, new SocketResponseResult(SocketCodeEnum.GROUP_APPLY_REJECT))
            return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
        })
    }
}