const CustomError = require("../Error/CustomError")
const SystemError = require("../Error/SystemError")
const HttpCodeEnum = require("../enum/HttpCodeEnum")
const SocketCodeEnum = require("../enum/SocketCodeEnum")
const ResponseResult = require("../models/ResponseResult")
const SocketResponseResult = require("../models/SocketResponseResult")
const { ApplyGroup } = require("../models/applyGroup")
const { Group } = require("../models/group")
const { User } = require("../models/user")
const ObjectId = require('mongoose').Types.ObjectId 

// 创建群组
exports.createGroup = (groupName, userId, type, res)=>{
    Group.create({name: groupName, owner: userId, members: [userId], type}, (err, data)=>{
        if(err) throw new SystemError(res, err)
        return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, data)
    })
}

// 获取群组列表
exports.getGroups = (_id, res)=>{
    Group.find({members: _id }).exec((err, group)=>{
        if(err) throw new SystemError(res, err)
        return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, group)
    })
}

// 获取群组列表
exports.getRecommandGroups = (res)=>{
    Group.find({isRecommended: true}).exec((err, group)=>{
        if(err) throw new SystemError(res, err)
        return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, group)
    })
}

// 根据群组名获取群组列表
exports.getGroupsByName = (name, res)=>{
    Group.find({ name: {$regex: new RegExp('.*'+name+'.*', 'i')} }).exec((err, group)=>{
        if(err) throw new SystemError(res, err)
        return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, group)
    })
}

// 是否成员
exports.isMember = async(from, to)=>{
    var v = await new Promise((resolve, reject) => {
        Group.findOne({_id:to}, (err, todata)=>{
            if(err || !todata) resolve('error')
            
            if(todata.members.indexOf(from) === -1)
                resolve(false)
            resolve(true)     
        })
    })
    return v        
}

// 获取成员列表
exports.getMembers = (groupId, res)=>{
    Group.findOne({_id:groupId}).exec((err,group)=>{
        if(err) throw new SystemError(res, err)
        if(!group) return ResponseResult.errorResult(res, HttpCodeEnum.GROUP_NOT_EXIST)
        User.find({_id:group.members}).select(['_id','username','nickname','avatar','introduction','location','regDate']).exec((err, member)=>{
            if(err) throw new SystemError(res, err)
            return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, member)
        })
    })
}

// 移除成员
exports.removeMember = (groupId, _id, res)=>{
    // 查找群组
    Group.findOne({_id:groupId}).exec((err,group)=>{
        if(err) throw new SystemError(res, err)
        if(!group) return ResponseResult.errorResult(res, HttpCodeEnum.GROUP_NOT_EXIST)
        // 移除特定成员
        group.members.splice(group.members.indexOf(ObjectId(_id)),1)
        // 保存
        group.save((err, _)=>{
            if(err) throw new SystemError(res, err)
            return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
        })
    })
}

// 转让群组
exports.transferGroup = (groupId, _id, res, server)=>{
    Group.findOneAndUpdate({_id:groupId}, {$set:{owner:ObjectId(_id)}}).exec((err,result)=>{
        if(err) throw new SystemError(res, err)
        if(result){
            ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
            server.to(_id).emit(_id, new SocketResponseResult(SocketCodeEnum.BE_OWNER, groupId))
        }else{
            ResponseResult.errorResult(res, HttpCodeEnum.NOT_DELETED)
        }
        
    })
}

// 加入群组
exports.addGroup = (from, to, res, server)=>{
    Group.findOne({_id: to}).exec().then((group)=>{
        if(err) throw new SystemError(res, err)
        if(!group) throw new CustomError(res, HttpCodeEnum.GROUP_NOT_EXIST)
        if(group.members.indexOf(from) !== -1) throw new CustomError(res, HttpCodeEnum.OBJECT_ALREADY_IN_GROUP)
        // 添加到成员列表
        group.members.push(from)
        // 保存
        group.save().then(()=>{
            server.to(from).emit(from, new SocketResponseResult(SocketCodeEnum.NEW_GROUP))
            // 群员将收到新成员通知
            server.to('group:' + to, SocketCodeEnum.NEW_MEMBER).emit('new', SocketCodeEnum.NEW_MEMBER)
            // 删除申请记录
            ApplyGroup.remove({from,to}).then(()=>{
                return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
            })
        })
    })
}

// 退出群聊
exports.exitGroup = (groupId, userId, res)=>{
    // 查找特定群组
    Group.findOne({_id:groupId}).exec().then((group)=>{
        // 群组不存在
        if(!group) return ResponseResult.errorResult(res, HttpCodeEnum.GROUP_NOT_EXIST)
        
        // 如果请求用户为群主，且群组存在其他成员，则必须先转让群组
        if(group.owner == ObjectId(userId) && group.members.length > 1) 
            return ResponseResult.errorResult(res, HttpCodeEnum.TRANSFER_GROUP_TO_OTHERS)
        
        // 将特定用户移出群组
        group.members.splice(group.members.indexOf(ObjectId(userId)),1)
        
        // 如果退出后群组无成员，则解散
        if(group.members.length == 0){
            group.remove().then(()=>{
                return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
            })
        // 保存
        }else{
            group.save().then(()=>{
                return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
            })
        }
    })
}

// 解散群聊
exports.dismissGroup = (groupId, res)=>{
    // 查找并删除指定群组
    Group.findOneAndRemove({_id:groupId}).exec().then(()=>{
        return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
    })
}

// 修改群组简介
exports.updateDescription = async(groupId, description, res)=>{
    Group.updateOne({_id:groupId},{$set:{description}}).exec().then(async(result)=>{
        // 未修改
        if(!result || result.modifiedCount == 0){
            return ResponseResult.errorResult(res, HttpCodeEnum.NOT_MODIFIED)
        }
        
        return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, description)
    })
}