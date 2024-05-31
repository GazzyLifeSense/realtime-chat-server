const SystemError = require("../Error/SystemError")
const HttpCodeEnum = require("../enum/HttpCodeEnum")
const SocketCodeEnum = require("../enum/SocketCodeEnum")
const ResponseResult = require("../models/ResponseResult")
const SocketResponseResult = require("../models/SocketResponseResult")
const { Chat } = require("../models/chat")
const { Group } = require("../models/group")
const { isFriend } = require("./Friend")
const { isMember } = require("./Group")
const fs = require('fs')

// 获取从 fromId 发到 toId 的信息
exports.getPrivateMsgs = (from, to, size, time, res)=>{
    let pageSize,before
    // 返回信息条数
    if(size) pageSize = size
    else pageSize = 10 
    // 用于获取更早于某时间的信息
    if(time == -1) before = Number.POSITIVE_INFINITY
    else before = time
    // 查找消息记录
    Chat.find({$or:[{from, to},{from: to, to: from}],'create_time':{$lt:before}}).sort({'create_time':-1}).limit(pageSize).exec().then((msg)=>{
        return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, msg.reverse())
    })
    
}

exports.getGroupMsgs = (groupId, size, time, res)=>{
    let pageSize,before
    // 默认返回信息条数
    if(size) pageSize = size
    else pageSize = 10 
    // 用于获取更早信息
    if(time == -1) before = Number.POSITIVE_INFINITY
    else before = time

    Chat.find({to: groupId, 'create_time':{$lt:before}}).sort({'create_time':-1}).limit(pageSize).exec((err, msg)=>{
        if(err) throw new SystemError(res, err)
        return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, msg.reverse())
    })
}

// 发送图片
exports.sendPic = async(from, to, filename, filetype, type, file, hash, res, server)=>{
    if(!/image/.test(filetype)) return ResponseResult.errorResult(res, HttpCodeEnum.FILETYPE_NOT_SUPPORT)
    if(type === 1){
        // 检测是否为好友
        let res = await isFriend(from, to)
        if(res == 'error'){
            return server.to(from).emit(from, new SocketResponseResult(SocketCodeEnum.SYSTEM_ERROR))
        }else if(!res){
            return server.to(from).emit(from, new SocketResponseResult(SocketCodeEnum.BEEN_DELETED))
        }
    }
    else if(type === 2){
        // 检测是否为成员
        let res = await isMember(from, to)
        if(res == 'error'){
            return server.to(from).emit(from, new SocketResponseResult(SocketCodeEnum.SYSTEM_ERROR))
        }else if(!res){
            return server.to(from).emit(from, new SocketResponseResult(SocketCodeEnum.BEEN_REMOVED))
        }
    }

    
    // 文件名
    let picname = hash + filename.slice(filename.lastIndexOf('.')) 
    
    // 文件是否已存在
    let exist = await new Promise((resolve, reject)=>{
        Chat.findOne({content: picname, isPic: 1}).then((chat)=>{
            if(chat) resolve(true)
            resolve(false)
        })
    })
    if(exist == 'error') return ResponseResult.errorResult(res, HttpCodeEnum.SYSTEM_ERROR)
    if(exist) {
        notice()
        return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
    }
    // 获取文件流
    file = file.replace(/^data:image\/\w+;base64,/,"")
    let buffer = Buffer.from(file, 'base64')

    // 保存图片
    let uploadDir = process.env['CHAT_PIC_PATH']
    fs.writeFile(uploadDir+picname, buffer, async(err)=>{
        if(err) throw new SystemError(res, err)

        notice()
        ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
    })

    function notice(){
        new Chat({from, to, type, content:picname, isPic:1, create_time: Date.now()}).save().then((chatMsg)=>{
            if(chatMsg) {     
                // 提示发送方和接收方
                if(type == 1){
                    server.to(to).emit(to, new SocketResponseResult(SocketCodeEnum.PRIVATE_MSG, chatMsg))
                    server.to(from).emit(from, new SocketResponseResult(SocketCodeEnum.PRIVATE_MSG, chatMsg))
                // 提示成员
                }else if(type == 2){
                    Group.findOne({_id: to}).exec((err, group)=>{
                        if(err) throw new SystemError(res, err)
                        if(group){
                            group.members.forEach((user)=>{
                                server.to(user.toString()).emit(user.toString(), new SocketResponseResult(SocketCodeEnum.GROUP_MSG, chatMsg))
                            })
                        }else{
                            server.to(from).emit(from, new SocketResponseResult(SocketCodeEnum.TARGET_NOT_EXIST))
                        }
                    })
                }
            }else{
                return ResponseResult.errorResult(res, HttpCodeEnum.TARGET_NOT_EXIST)
            }       
            
        })
    }
}
          