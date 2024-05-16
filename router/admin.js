const { app } = require('@/server')
// 参数校验中间件
const { validatorRules, validator } = require('@/middleware/validator')
const bcrypt = require('bcryptjs/dist/bcrypt')
const SocketCodeEnum = require('@/enum/SocketCodeEnum')
const ResponseResult = require("@/models/ResponseResult")
const SystemError = require("@/Error/SystemError")

//#region 管理员
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
    validatorRules.isRecommended,
    validator,
    async (req, res)=>{
        Group.updateOne({_id:req.body.groupId},{$set:{isRecommended:req.body.isRecommended}}).exec(async(err, result)=>{
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
//#endregion