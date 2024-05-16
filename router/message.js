const { app } = require('@/server')
// 参数校验中间件
const { validatorRules, validator } = require('@/middleware/validator')
// 权限校验中间件
const PermissionMiddleware = require('@/middleware/permission')
// multipart
var multipart = require('connect-multiparty');
var multipartMiddleware = multipart({ maxFieldsSize: 5 * 1024 * 1024 });
// api
const { getGroupMsgs, getPrivateMsgs, sendPic } = require('@/service/Message');

//#region 消息
// 获取私聊记录
app.post('/getPrivateMsgs', 
    validatorRules.to,
    validatorRules.userId,
    validatorRules.size,
    validatorRules.time,
    validator,
    PermissionMiddleware.AuthByUserId,
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
    PermissionMiddleware.CheckMembershipByGroupId,
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
    PermissionMiddleware.AuthByUserId, 
    (req, res)=>{
        sendPic(req.body.userId, req.body.to, req.body.filename, req.body.fileType, req.body.type, req.body.file, req.body.hash, res, server)
    }
)
//#endregion
