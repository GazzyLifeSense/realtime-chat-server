// @ts-nocheck
var express = require('express');
var app = express();
var path = require('path');
var cors = require('cors');
var bodyParser = require('body-parser')
require('dotenv').config()
const fs = require('fs')
const https = require('https')
require('express-async-errors')

let ObjectId = require('mongoose').Types.ObjectId 
const { createServer } = require('http')
const httpServer = createServer(app)

let ResponseResult = require("./models/ResponseResult.js")
let HttpCodeEnum = require("./enum/HttpCodeEnum")

// multipart
var multipart = require('connect-multiparty');
var multipartMiddleware = multipart({maxFieldsSize:5 * 1024 * 1024});

// 创建socket
const server = require('./service/socket.io.server')(httpServer)

// redis
const redisClient = require('./config/redisConfig');

// model
const SystemError = require("./Error/SystemError");
const CustomError = require('./Error/CustomError');
const { User } = require('./models/user');
const { Group } = require('./models/group');
const { Chat } = require('./models/chat');

// services
const { login, adminLogin, register, verifyAndGetUser, updateNickname, updateIntroduction, updatePassword } = require('./service/User');
const { applyFriend, applyGroup, hasApplies, getFriendApplies, getGroupApplies, removeApply } = require('./service/Applies');
const { getFriends, addFriend, deleteFriend } = require('./service/Friend');
const { addGroup, createGroup, getGroups, getGroupsByName, getMembers, removeMember, exitGroup, dismissGroup, updateDescription, getRecommandGroups, transferGroup } = require('./service/Group');
const { getGroupMsgs, getPrivateMsgs, sendPic } = require('./service/Message');
const { uploadImg } = require('./service/Upload');

// 参数校验
const { body, validationResult, Result } = require('express-validator');
const SocketCodeEnum = require('./enum/SocketCodeEnum');
const bcrypt = require('bcryptjs/dist/bcrypt');
app.use(bodyParser.json({limit:'10mb'}))
app.use(bodyParser.urlencoded({ limit:'10mb', extended: true }));
// app.use(bodyParser.urlencoded({extended: false}))
app.use(cors({ optionsSuccessStatus: 200 }));
// 指定静态资源存放目录并加载
app.use(express.static(path.join(__dirname, 'public')));


// // 异常处理
process.on('uncaughtException', function(err){
    // 响应请求
    if(err instanceof SystemError){
        ResponseResult.errorResult(err.res, err.httpCodeEnum)
    }else if(err instanceof CustomError){
        ResponseResult.errorResult(err.res, err.httpCodeEnum)
    }
    // 输出异常信息
    console.log(err.message, err.stack)
})

  
// 参数校验中间件
let validator = (req, res, next)=>{
    const errors = validationResult(req);
    // 参数非法，拦截并返回错误信息
    if (!errors.isEmpty()) {
        return ResponseResult.errorResult(res, HttpCodeEnum.PARAM_INVALID, errors.array.toString())
    }
    next()
}
// 统一校验规则
let validatorRules = {
    'username': body('username').isString().isLength({min: 1, max: 15}),
    'password': body('password').isString().isLength({min: 1, max: 15}),
    'newPassword': body('newPassword').isString().isLength({min: 1, max: 15}),
    'nickname': body('nickname').isString().isLength({min: 1, max: 8}),
    'introduction': body('introduction').isString().isLength({min: 1, max: 25}),
    'userId': body('userId').isMongoId(),
    'groupId': body('groupId').isMongoId(),
    'groupName': body('groupName').isString().isLength({min: 1, max: 14}),
    'description': body('description').isLength({min: 1, max: 40}),
    'isBanned': body('isBanned').isBoolean(),
    'isRecommanded': body('isRecommanded').isBoolean(),
    'from': body('from').isMongoId(),
    'to': body('to').isMongoId(),
    'type': body('type').isString().isLength({min:1}),
    'size': body('size').isInt({min: 1,max: 15}),
    "time": body('time').isInt(),
    'filename': body('filename').isString().isLength({min:1}),
    'fileType': body('fileType').isString().isLength({min:1}),
    'file': body('file').notEmpty(),
    'hash': body('hash').isLength({min:32, max:32}),
}

// 用户本人验证
let AuthByUserId = async(req, res, next)=>{
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
let CheckMembershipByGroupId = async(req, res, next)=>{
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
let checkOwnershipByGroupId =  async(req, res, next)=>{
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

//#region 用户
// 登录
app.post('/login',
    validatorRules.username,
    validatorRules.password,
    validator,
    (req, res)=>{
        login(req.body.username, req.body.password, req, res)
    }
);
// 管理员登录
app.post('/adminLogin', 
    validatorRules.username,
    validatorRules.password,
    validator,
    (req, res)=>{
        adminLogin(req.body.username, req.body.password, res)
    }
);
// 注册
app.post('/register', 
    validatorRules.username,
    validatorRules.password,
    validatorRules.nickname,
    validator,
    (req, res)=>{
        register(req.body.username, req.body.password, req.body.nickname, req, res)
    }
);
// 验证token并获取用户信息
app.post('/verifyAndGetUser', 
    (req, res)=>{
        verifyAndGetUser(res, req.headers.token)
    }
);

// 修改昵称
app.post('/updateNickname', 
    validatorRules.userId,
    validatorRules.nickname,
    validator,
    AuthByUserId,
    (req, res)=>{
        updateNickname(req.body.userId, req.body.nickname, res)
    }
);
// 修改个人介绍
app.post('/updateIntroduction', 
    validatorRules.userId,
    validatorRules.introduction,
    validator,
    AuthByUserId,
    (req, res)=>{
        updateIntroduction(req.body.userId, req.body.introduction, res)
    }
);
// 修改密码
app.post('/updatePassword', 
    validatorRules.userId,
    validatorRules.password,
    validatorRules.newPassword,
    validator,
    AuthByUserId,
    (req, res)=>{
        updatePassword(req.body.userId, req.body.password, req.body.newPassword, res)
    }
);
//#endregion

//#region 好友
app.post('/getFriends', 
    validatorRules.userId,
    validator,
    AuthByUserId,
    (req, res)=>{
        getFriends(req.body.userId, res)
    }
)

app.post('/deleteFriend', 
    validatorRules.userId,
    validatorRules.to,
    validator,
    AuthByUserId,
    (req, res)=>{
        deleteFriend(req.body.userId, req.body.to, res)
    }
)
//#endregion

//#region 消息
// 获取私聊记录
app.post('/getPrivateMsgs', 
    validatorRules.to,
    validatorRules.userId,
    validatorRules.size,
    validatorRules.time,
    validator,
    AuthByUserId,
    (req, res)=>{
        getPrivateMsgs(req.body.to, req.body.userId, req.body.size, req.body.time, res)
    }
)
// 获取群聊记录
app.post('/getGroupMsgs', 
    validatorRules.groupId,
    validatorRules.size,
    validatorRules.time,
    validator,
    CheckMembershipByGroupId,
    (req, res)=>{
        getGroupMsgs(req.body.groupId, req.body.size, req.body.time, res)
    }
)
// 发送图片
app.post('/sendPic', 
    multipartMiddleware, 
    validatorRules.userId,
    validatorRules.to,
    validatorRules.filename,
    validatorRules.fileType,
    validatorRules.type,
    validatorRules.file,
    validatorRules.hash,
    validator,
    AuthByUserId, 
    (req, res)=>{
        sendPic(req.body.userId, req.body.to, req.body.filename, req.body.fileType, req.body.type, req.body.file, req.body.hash, res, server)
    }
)
//#endregion

//#region 群组
// 创建群组
app.post('/createGroup', 
    validatorRules.groupName,
    validatorRules.userId,
    validatorRules.type,
    validator,
    AuthByUserId,
    (req, res)=>{
        createGroup(req.body.groupName, req.body.userId, req.body.type, res)
    }
)
// 获取群组列表
app.post('/getGroups', 
    validatorRules.userId,
    validator,
    AuthByUserId,
    (req, res)=>{
        getGroups(req.body.userId, res)
    }
)
// 获取推荐群组列表
app.get('/getRecommandGroups', 
    (req, res)=>{
        getRecommandGroups(res)
    }
)
// 获取成员列表
app.post('/getMembers', 
    validatorRules.groupId,
    validator,
    CheckMembershipByGroupId,
    (req, res)=>{
        getMembers(req.body.groupId, res)
    }
)
// 移除成员
app.post('/removeMember', 
    validatorRules.groupId,
    validatorRules.to,
    validator,
    checkOwnershipByGroupId,
    (req, res)=>{
        removeMember(req.body.groupId, req.body.to, res)
    }
)
// 移除成员
app.post('/transferGroup', 
    validatorRules.groupId,
    validatorRules.to,
    validator,
    checkOwnershipByGroupId,
    (req, res)=>{
        transferGroup(req.body.groupId, req.body.to, res, server)
    }
)
// 退出群组
app.post('/exitGroup', 
    validatorRules.groupId,
    validatorRules.userId,
    validator,
    (req, res)=>{
        exitGroup(req.body.groupId, req.body.userId, res)
    }
)
// 解散群组
app.post('/dismissGroup', 
    validatorRules.groupId,
    validator,
    checkOwnershipByGroupId,
    (req, res)=>{
        dismissGroup(req.body.groupId, res)
    }
)
// 根据群名查询群组
app.post('/getGroupsByName', 
    validatorRules.groupName,
    validator,
    (req, res)=>{
        getGroupsByName(req.body.groupName, res)
    }
)
// 修改群组简介
app.post('/updateGroupDescription', 
    validatorRules.groupId,
    validatorRules.description,
    validator,
    checkOwnershipByGroupId,
    (req, res)=>{
        updateDescription(req.body.groupId, req.body.description, res)
    }
);
//#endregion

//#region 申请
app.post('/hasApplies', 
    validatorRules.userId,
    validator,
    AuthByUserId,
    (req, res)=>{
        hasApplies(req.body.userId, res)
    }
)
app.post('/getFriendApplies', 
    validatorRules.userId,
    validator,
    AuthByUserId,
    (req, res)=>{
        getFriendApplies(req.body.userId, res)
    }
)
app.post('/getGroupApplies',
    validatorRules.userId,
    validator,
    AuthByUserId, 
    (req, res)=>{
        getGroupApplies(req.body.userId, res)
    }
)
// 拒绝好友申请
app.post('/rejectFriendApply', 
    validatorRules.from,
    validatorRules.userId,
    validator,
    AuthByUserId,
    (req, res)=>{
        removeApply(req.body.from, req.body.userId, 'friend', res, server)
})
// 拒绝群组申请
app.post('/rejectGroupApply', 
    validatorRules.from,
    validatorRules.groupId,
    validator,
    checkOwnershipByGroupId,
    (req, res)=>{
        removeApply(req.body.from, req.body.groupId, 'group', res, server)
})
// 申请好友
app.post('/applyFriend',
    validatorRules.userId,
    validatorRules.username,
    validator,
    AuthByUserId, 
    (req,res)=>{
        console.log('[好友申请]' + req.body.userId,'->',req.body.username)
        applyFriend(req.body.userId, req.body.username, res, server)
    }
)
// 申请群组
app.post('/applyGroup', 
    validatorRules.userId,
    validatorRules.groupId,
    validator,
    AuthByUserId,
    (req,res)=>{
        console.log('[群组申请]' + req.body.userId,'->',req.body.groupId)
        applyGroup(req.body.userId, req.body.groupId, res, server)
    }
)
// 接受好友申请
app.post('/acceptFriendApply', 
    validatorRules.from,
    validatorRules.userId,
    validator,
    AuthByUserId,
    (req, res)=>{
        addFriend(req.body.from, req.body.userId, res, server)
    }
)
// 接受群组申请
app.post('/acceptGroupApply', 
    validatorRules.from,
    validatorRules.groupId,
    validator,
    checkOwnershipByGroupId,
    (req, res)=>{
        addGroup(req.body.from, req.body.groupId, res, server)
    }
)
//#endregion

//#region 上传
// 上传用户头像
app.post('/uploadAvatar', 
    multipartMiddleware, 
    validatorRules.userId,
    validatorRules.filename,
    validatorRules.fileType,
    validatorRules.file,
    validator,
    AuthByUserId, 
    (req, res)=>{
        uploadImg(req.body.userId, req.body.filename, req.body.fileType, req.body.file, 0, res)
    }
)
// 上传群组头像
app.post('/uploadGroupAvatar', 
    multipartMiddleware, 
    validatorRules.groupId,
    validatorRules.filename,
    validatorRules.fileType,
    validatorRules.file,
    validator,
    checkOwnershipByGroupId, 
    (req, res)=>{
    
        uploadImg(req.body.groupId, req.body.filename, req.body.fileType, req.body.file, 1, res)
    }
)
// 上传群组横幅
app.post('/uploadGroupBanner', 
    multipartMiddleware, 
    checkOwnershipByGroupId, 
    validatorRules.groupId,
    validatorRules.filename,
    validatorRules.fileType,
    validatorRules.file,
    validator,
    (req, res)=>{
            uploadImg(req.body.groupId, req.body.filename, req.body.fileType, req.body.file, 2, res)
    }
)
//#endregion

//#region 统计
// 获取在线终端数
app.get('/getOnlineCount', async (req, res)=>{
    ResponseResult.okResult(res,HttpCodeEnum.SUCCESS,(await server.fetchSockets()).length.toString())
})

// 获取在线终端数
app.get('/getOnlineUserCount', async (req, res)=>{
    ResponseResult.okResult(res,HttpCodeEnum.SUCCESS,(await redisClient.KEYS('user:*')).length.toString())
})

// 获取注册用户数量
app.get('/getUserCount', async (req, res)=>{
    User.count().exec(async(err, count)=>{
        if(err) throw new SystemError(res, err)
        ResponseResult.okResult(res,HttpCodeEnum.SUCCESS,count.toString())
    })
})

// 获取群组数量
app.get('/getGroupCount', async (req, res)=>{
    Group.count().exec(async(err, count)=>{
        if(err) throw new SystemError(res, err)
        ResponseResult.okResult(res,HttpCodeEnum.SUCCESS,count.toString())
    })
})

// 获取聊天信息数量
app.get('/getMessageCount', async (req, res)=>{
    Chat.count().exec(async(err, count)=>{
        if(err) throw new SystemError(res, err)
        ResponseResult.okResult(res,HttpCodeEnum.SUCCESS,count.toString())
    })
})

// 获取最活跃群组排行
app.get('/getTopActiveGroup', async (req, res)=>{
    Chat.aggregate([
        // 限定为群聊消息
        { $match:{type:2} },
        // 根据群id分组，并计算各自的消息数
        {
            $group:{
                _id: "$to",
                count: {$sum:1}
            }
        },
        // 选取10个
        { $limit: 10 },
        // 获取群组详细信息
        {
            $lookup:{
                from: 'groups',
                localField: '_id',
                foreignField: '_id',
                as: 'groupDetail'
            }
        },
        // 保留需要的字段
        {
            $project:{
                'count':1,
                'groupDetail.name':1,
                'groupDetail.members':1,
                'groupDetail.type':1
            }
        },
        // 拆分数组
        { $unwind: '$groupDetail'},
        // 排序
        { $sort: {"count":-1} }
    ]).exec((err, result)=>{
        if(err) throw new SystemError(res, err)
        return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, result)
    })
})

// 获取用户归属地占比
app.get('/getUserLocationPercent', async (req, res)=>{
    User.aggregate([
        {
            $group: {
                _id: '$location',
                count: {$sum:1}
            }
        },
        {
            $project: {name: '$_id', value: '$count', _id:0}
        }
    ]).exec((err, result)=>{
        if(err) return new SystemError(res, err)
        return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, result)
    })
})
//#endregion

// 批量创建用户
app.get('/createTestUsers', async(req,res)=>{
    // BCrypt算法加密
    let password = await new Promise((resolve, reject) => {
        bcrypt.hash('123456', 8, (err, hash)=>{
            if(err) reject(err)
            resolve(hash)
        })
    }).catch((err)=>{
        throw new SystemError(res, err)
    });
    
    let provinces = ["北京", "上海", "天津", "重庆", "河北", "山西", "内蒙古", "辽宁", "吉林", "黑龙江", "江苏",
                    "浙江", "安徽", "福建", "江西", "山东", "河南", "湖北", "湖南", "广东", "广西", "海南", "四川",
                    "贵州", "云南", "西藏", "陕西", "甘肃", "宁夏", "青海", "新疆", "香港", "澳门",
                    "台湾", "其它"]

    let amount = 10
    let userDocument = []
    for(let i = 0; i < amount; i++){
        let time = Date.now()
        userDocument.push({
            username: `testUser${time.toString().slice(-4,-1)}${i}`,
            nickname: `测试用户${time.toString().slice(-4,-1)}${i}`,
            regDate: time,
            password,
            location: provinces[Math.floor(Math.random()*provinces.length)]
        })
    }

    User.insertMany(userDocument, (err, result)=>{
        if(err) throw new SystemError(res, err)
        if(result?.length == amount){
            ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
        }else{
            ResponseResult.errorResult(res, HttpCodeEnum.COMPLETE_PARTIAL)
        }
            
        
    })
})

// 获取用户列表
app.get('/getUserList', async (req, res)=>{
    // 查找并返回结果
    User.find().exec(async(err, users)=>{
        if(err) throw new SystemError(res, err)
        return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, users)
    });
})

// 修改用户昵称
app.post('/updateNicknameByAdmin', 
    validatorRules.userId,
    validatorRules.nickname,
    validator,
    async (req, res)=>{
        User.updateOne({_id:req.body.userId},{$set:{nickname:req.body.nickname}}).exec(async(err, result)=>{
            if(err) throw new SystemError(res, err)
            if(!result || result.modifiedCount == 0) return ResponseResult.errorResult(res, HttpCodeEnum.NOT_MODIFIED)
            
            redisClient.del('user:'+req.body.userId)
            return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
        });
    })

// 封禁或解封用户
app.post('/banByAdmin', 
    validatorRules.userId,
    validatorRules.isBanned,
    validator,
    async (req, res)=>{
        let _id = req.body.userId
        User.updateOne({_id},{$set:{isBanned:req.body.isBanned}}).exec(async(err, result)=>{
            if(err || !result) throw new SystemError(res, err)
            // 修改成功          
            if(result.modifiedCount == 1) {
                if(req.body.isBanned==true){
                    // 删除缓存
                    redisClient.del('user:'+_id)
                    // 强制下线
                    server.to(_id).emit(_id,SocketCodeEnum.BANNED)
                }
                return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
            }
            return ResponseResult.errorResult(res, HttpCodeEnum.NOT_MODIFIED)
        });
    })

// 批量封禁或解封用户
app.post('/banManyByAdmin', 
    validatorRules.isBanned,
    validator,
    async (req, res)=>{
        let userIds = req.body.userIds
        User.updateMany({_id:userIds},{$set:{isBanned:req.body.isBanned}}).exec(async(err, result)=>{
            if(err || !result) throw new SystemError(res, err)

            // 修改成功          
            if(result.modifiedCount > 0) {
                if(req.body.isBanned==true)
                {
                    await userIds.forEach((_id)=>{
                        // 删除缓存
                        redisClient.del('user:'+_id)
                        // 强制下线
                        server.to(_id).emit(_id,SocketCodeEnum.BANNED)
                    })
                }
                return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
            }
            return ResponseResult.errorResult(res, HttpCodeEnum.NOT_MODIFIED)
        });
    })

// 删除用户
app.post('/removeUser', 
    validatorRules.userId,
    validator,
    async (req, res)=>{
        let userId = req.body.userId
        User.remove({_id: userId}).exec(async(err, result)=>{
            if(err || !result) throw new SystemError(res, err)
            if(result.deletedCount == 1){
                return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, result)
            }
            return ResponseResult.errorResult(res, HttpCodeEnum.NOT_DELETED)
        });
    })

// 批量删除用户
app.post('/removeManyUser', async (req, res)=>{
    let userIds = req.body.userIds
    User.remove({_id: userIds}).exec(async(err, result)=>{
        if(err || !result) throw new SystemError(res, err)
        if(result.deletedCount == userIds.length){
            return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, result)
        }
        return ResponseResult.errorResult(res, HttpCodeEnum.COMPLETE_PARTIAL)
    });
})

// 批量创建群组
app.post('/createTestGroups',
    validatorRules.userId,
    validator, 
    async(req,res)=>{
        let userId = req.body.userId
        let types = ['study', 'game', 'hobby']

        let amount = 5
        let groupDocument = []
        for(let i = 0; i < amount; i++){
            let time = Date.now()
            groupDocument.push({
                name: `测试群组${time.toString().slice(-4,-1)}${i}`,
                owner: userId, 
                members: [userId], 
                type: types[Math.floor(Math.random()*types.length)]
            })
        }

        Group.insertMany(groupDocument, (err, result)=>{
            if(err) throw new SystemError(res, err)
            if(result?.length == amount){
                ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
            }else{
                ResponseResult.errorResult(res, HttpCodeEnum.COMPLETE_PARTIAL)
            }
        })
    })

// 获取群组列表
app.get('/getGroupList', async (req, res)=>{
    Group.find().exec(async(err, groups)=>{
        if(err) throw new SystemError(res, err)
        return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, groups)
    });
})

// 修改群组推荐状态
app.post('/recommandByAdmin', 
    validatorRules.groupId,
    validatorRules.isRecommanded,
    validator,
    async (req, res)=>{
        Group.updateOne({_id:req.body.groupId},{$set:{isRecommanded:req.body.isRecommanded}}).exec(async(err, result)=>{
            if(err) throw new SystemError(res, err)
            if(!result || result.modifiedCount == 0) return ResponseResult.errorResult(res, HttpCodeEnum.NOT_MODIFIED)
            return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
        });
    })

// 修改群组昵称
app.post('/updateGroupnameByAdmin', 
    validatorRules.groupId,
    validatorRules.groupName,
    validator,
    async (req, res)=>{
        Group.updateOne({_id:req.body.groupId},{$set:{name:req.body.groupName}}).exec(async(err, result)=>{
            if(err) throw new SystemError(res, err)
            if(!result || result.modifiedCount == 0) return ResponseResult.errorResult(res, HttpCodeEnum.NOT_MODIFIED)
            return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
        });
    })

// 解散群组
app.post('/dismissByAdmin', 
    validatorRules.groupId,
    validator,
    async (req, res)=>{
        let _id = req.body.groupId
        Group.remove({_id}).exec(async(err, result)=>{
            if(err || !result) throw new SystemError(res, err)
            // 删除成功          
            if(result.deletedCount == 1) {
                return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
            }
            return ResponseResult.errorResult(res, HttpCodeEnum.NOT_DELETED)
        });
    })

// 批量解散群组
app.post('/dismissManyByAdmin', 
    async (req, res)=>{
        let groupIds = req.body.groupIds
        if(groupIds.length == 0) return ResponseResult.errorResult(res, HttpCodeEnum.CONTENT_NOT_NULL)
        Group.remove({_id:groupIds}).exec(async(err, result)=>{
            if(err || !result) throw new SystemError(res, err)
            // 删除成功          
            if(result.deletedCount == groupIds.length) {
                return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS)
            }
            return ResponseResult.errorResult(res, HttpCodeEnum.NOT_DELETED)
        });
    })


httpServer.listen(3000, function(){
    console.log('[Init]服务器已开放在端口：' + this.address().port)
})

module.exports = {app,server}