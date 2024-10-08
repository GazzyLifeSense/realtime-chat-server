const HttpCodeEnum = require("../enum/HttpCodeEnum")
const SocketCodeEnum = require("../enum/SocketCodeEnum")
const ResponseResult = require("../models/ResponseResult")
const SocketResponseResult = require("../models/SocketResponseResult")
const { ApplyGroup } = require("../models/applyGroup")
const { Group } = require("../models/group")
const { User } = require("../models/user")
const ObjectId = require('mongoose').Types.ObjectId 

// 创建群组
exports.createGroup = async(groupName, userId, type, res)=>{
    const newGroup = await Group.create({ name: groupName, owner: userId, members: [userId], type })
    return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, newGroup)
}

// 获取群组列表
exports.getGroups = (_id, res)=>{
    Group.find({members: _id }).exec().then((group)=>{
        return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, group)
    })
}

// 获取群组列表
exports.getRecommendGroups = (res)=>{
    Group.find({ isRecommended: true }).exec().then((group) => {
        console.log(group)
        return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, group)
    })
}

// 根据群组名获取群组列表
exports.getGroupsByName = (name, res)=>{
    Group.find({ name: {$regex: new RegExp('.*'+name+'.*', 'i')} }).exec().then((group)=>{
        return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, group)
    })
}

// 是否成员
exports.isMember = async(from, to)=>{
    var v = await new Promise((resolve) => {
        Group.findOne({_id:to}).then((todata)=>{
            if(!todata) resolve('error')
            
            if(todata.members.indexOf(from) === -1)
                resolve(false)
            resolve(true)     
        })
    })
    return v        
}

// 获取成员列表
exports.getMembers = (groupId, res)=>{
    Group.findOne({_id:groupId}).exec().then((group)=>{
        if(!group) return ResponseResult.errorResult(res, HttpCodeEnum.TARGET_NOT_EXIST)
        User.find({_id:group.members}).select(['_id','username','nickname','avatar','introduction','location','regDate']).exec().then((member)=>{
            return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, member)
        })
    })
}

// 移除成员
exports.removeMember = (groupId, _id, res)=>{
    // 查找群组
    Group.findOne({_id:groupId}).exec().then((group)=>{
        if(!group) return ResponseResult.errorResult(res, HttpCodeEnum.TARGET_NOT_EXIST)
        // 移除特定成员
        group.members.splice(group.members.indexOf(new ObjectId(_id)),1)
        // 保存
        group.save().then(()=>{
            return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
        })
    })
}

// 转让群组
exports.transferGroup = (groupId, _id, res, server)=>{
    Group.findOneAndUpdate({_id:groupId}, {$set:{owner:new ObjectId(_id)}}).exec().then((result)=>{
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
        if(!group) return ResponseResult.errorResult(res, HttpCodeEnum.TARGET_NOT_EXIST)
        if(group.members.indexOf(from) !== -1)  return ResponseResult.errorResult(res, HttpCodeEnum.DUPLICATE_OPERATE)
        // 添加到成员列表
        group.members.push(from)
        // 保存
        group.save().then(()=>{
            server.to(from).emit(from, new SocketResponseResult(SocketCodeEnum.NEW_GROUP))
            // 群员将收到新成员通知
            server.to('group:' + to, SocketCodeEnum.NEW_MEMBER).emit('new', SocketCodeEnum.NEW_MEMBER)
            // 删除申请记录
            ApplyGroup.deleteOne({from,to}).then(()=>{
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
        if(!group) return ResponseResult.errorResult(res, HttpCodeEnum.TARGET_NOT_EXIST)
        
        // 如果请求用户为群主，且群组存在其他成员，则必须先转让群组
        if(group.owner == new ObjectId(userId) && group.members.length > 1) 
            return ResponseResult.errorResult(res, HttpCodeEnum.INVALID_OPERATE)
        
        // 将特定用户移出群组
        group.members.splice(group.members.indexOf(new ObjectId(userId)),1)
        
        // 如果退出后群组无成员，则解散
        if(group.members.length == 0){
            group.deleteOne().then(()=>{
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