const { app } = require('@/server')
const ResponseResult = require("@/models/ResponseResult")
const SystemError = require("@/Error/SystemError")

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
    User.count().exec().then(async(count)=>{
        ResponseResult.okResult(res,HttpCodeEnum.SUCCESS,count.toString())
    })
})

// 获取群组数量
app.get('/getGroupCount', async (req, res)=>{
    Group.count().exec().then(async(count)=>{
        ResponseResult.okResult(res,HttpCodeEnum.SUCCESS,count.toString())
    })
})

// 获取聊天信息数量
app.get('/getMessageCount', async (req, res)=>{
    Chat.count().exec().then(async(count)=>{
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
    ]).exec().then((result)=>{
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
    ]).exec().then((result)=>{
        return ResponseResult.okResult(res, HttpCodeEnum.SUCCESS, result)
    })
})
//#endregion
