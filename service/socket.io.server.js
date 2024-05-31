const {Chat} = require('../models/chat')
const { Server } = require('socket.io')
const { Group } = require('../models/group')
const SocketResponseResult = require('../models/SocketResponseResult')
const SocketCodeEnum = require('../enum/SocketCodeEnum')
const { isFriend } = require('./Friend')
const { isMember } = require('./Group')
const redisClient = require('../config/redis')

module.exports = function (server) {
    const io = new Server(server,{
        cors: {
            origin: "*", 
        }
    })
    // 监视客户端与服务器的连接
    io.on('connection', async(socket)=>{
        
        // 验证是否为在线用户
        let token = socket.handshake.auth.token;
        let userId = await redisClient.get('token:' + token)
        if(!userId) return socket.disconnect()

        // 用户的不同终端都将加入一个以自己的userId命名的房间
        socket.leave(socket.id)
        socket.join(userId)

        console.log('[用户连接]socketId:', socket.id, '| userId:', userId);
        socket.on('logout', ()=>{
            redisClient.del('token:'+token)
        })
        socket.on('disconnect', () => {
            console.log('[用户断线]socketid:', socket.id, '| userId:', userId);
        });
        // 绑定监听, 接收客户端发送的消息
        socket.on('sendMsg', async function ({token, from, to, content, type}) {
            if(!token) return
            // 验证是否为用户本人发送信息
            let userId = await redisClient.get('token:' + token)
            if(!userId || userId != from) return socket.disconnect()
            if(content.length > 50) return io.to(from).emit(from, new SocketResponseResult(SocketCodeEnum.SYSTEM_ERROR))
            
            console.log(from, to, content, type) 
            if(type === 1){
                // 检测是否为好友
                let res = await isFriend(from, to)
                if(res == 'error'){
                    return io.to(from).emit(from, new SocketResponseResult(SocketCodeEnum.SYSTEM_ERROR))
                }else if(!res){
                    return io.to(from).emit(from, new SocketResponseResult(SocketCodeEnum.BEEN_DELETED))
                }
            }
            else if(type === 2){
                // 检测是否为成员
                let res = await isMember(from, to)
                if(res == 'error'){
                    return io.to(from).emit(from, new SocketResponseResult(SocketCodeEnum.SYSTEM_ERROR))
                }else if(!res){
                    return io.to(from).emit(from, new SocketResponseResult(SocketCodeEnum.BEEN_REMOVED))
                }
            }
            // 存储消息记录
            new Chat({from, to, content, type, create_time: Date.now()}).save().then((chatMsg)=>{
                
                // 提示发送方和接收方
                if(type === 1){
                    io.to(to).emit(to, new SocketResponseResult(SocketCodeEnum.PRIVATE_MSG, chatMsg))
                    io.to(from).emit(from, new SocketResponseResult(SocketCodeEnum.PRIVATE_MSG, chatMsg))
                // 提示群组成员
                }else if(type === 2){
                    Group.findOne({_id: to}).exec((err, group)=>{
                        if(err) return 
                        if(group){
                            group.members.forEach((user)=>{
                                io.to(user.toString()).emit(user.toString(), new SocketResponseResult(SocketCodeEnum.GROUP_MSG, chatMsg))
                            })
                        }else{
                            io.to(from).emit(from, new SocketResponseResult(SocketCodeEnum.TARGET_NOT_EXIST))
                        }
                    })
                }
            })
        })

        // 进入群聊
        socket.on('enterGroupChat', async({token, groupId})=>{
            // 验证是否为群组成员
            let userId = await redisClient.get('token:' + token)
            if(!userId) return
            let res = await isMember(userId, groupId)
            if(res == 'error'){
                return io.to(userId).emit(userId, new SocketResponseResult(SocketCodeEnum.SYSTEM_ERROR))
            }else if(!res){
                return io.to(userId).emit(userId, new SocketResponseResult(SocketCodeEnum.BEEN_REMOVED))
            }

            socket.join('group:' + groupId)
            console.log('[进入群聊]userId:', userId, ' -> groupId:', groupId)
        })

        // 离开群聊
        socket.on('leaveGroupChat', async({token, groupId})=>{
            // 验证是否为群组成员
            let userId = await redisClient.get('token:' + token)
            if(!userId) return
            let res = await isMember(userId, groupId)
            if(res == 'error'){
                return io.to(userId).emit(userId, new SocketResponseResult(SocketCodeEnum.SYSTEM_ERROR))
            }else if(!res){
                return io.to(userId).emit(userId, new SocketResponseResult(SocketCodeEnum.BEEN_REMOVED))
            }
            socket.leave('group:' + groupId)
            console.log('[离开群聊]userId:', userId, ' ↓ groupId:', groupId)
        })
    })
    return io;
}