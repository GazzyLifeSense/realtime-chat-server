const { app, server } = require('@/server')
// 参数校验中间件
const { validatorRules, validator } = require('@/middleware/validator')
// 权限校验中间件
const PermissionMiddleware = require('@/middleware/permission')
// multipart
var multipart = require('connect-multiparty');
var multipartMiddleware = multipart({ maxFieldsSize: 5 * 1024 * 1024 });
// api
const { createGroup, getGroups, getGroupsByName, getMembers, removeMember, exitGroup, dismissGroup, updateDescription, getRecommendGroups, transferGroup } = require('@/service/Group');
const { uploadImg } = require('@/service/Upload');
//#region 群组
// 创建群组
app.post('/createGroup', 
    validatorRules.groupName,
    validatorRules.userId,
    validatorRules.type,
    validator,
    PermissionMiddleware.AuthByUserId,
    (req, res)=>{
        createGroup(req.body.groupName, req.body.userId, req.body.type, res)
    }
)
// 获取群组列表
app.post('/getGroups', 
    validatorRules.userId,
    validator,
    PermissionMiddleware.AuthByUserId,
    (req, res)=>{
        getGroups(req.body.userId, res)
    }
)
// 获取推荐群组列表
app.get('/getRecommendGroups', 
    (req, res)=>{
        getRecommendGroups(res)
    }
)
// 获取成员列表
app.post('/getMembers', 
    validatorRules.groupId,
    validator,
    PermissionMiddleware.CheckMembershipByGroupId,
    (req, res)=>{
        getMembers(req.body.groupId, res)
    }
)
// 移除成员
app.post('/removeMember', 
    validatorRules.groupId,
    validatorRules.to,
    validator,
    PermissionMiddleware.CheckOwnershipByGroupId,
    (req, res)=>{
        removeMember(req.body.groupId, req.body.to, res)
    }
)
// 移除成员
app.post('/transferGroup', 
    validatorRules.groupId,
    validatorRules.to,
    validator,
    PermissionMiddleware.CheckOwnershipByGroupId,
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
    PermissionMiddleware.CheckOwnershipByGroupId,
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
    PermissionMiddleware.CheckOwnershipByGroupId,
    (req, res)=>{
        updateDescription(req.body.groupId, req.body.description, res)
    }
);
// 上传群组头像
app.post('/uploadGroupAvatar', 
    multipartMiddleware, 
    validatorRules.groupId,
    validatorRules.filename,
    validatorRules.fileType,
    validatorRules.file,
    validator,
    PermissionMiddleware.CheckOwnershipByGroupId, 
    (req, res)=>{
        uploadImg(req.body.groupId, req.body.filename, req.body.fileType, req.body.file, 1, res)
    }
)
// 上传群组横幅
app.post('/uploadGroupBanner', 
    multipartMiddleware, 
    PermissionMiddleware.CheckOwnershipByGroupId, 
    validatorRules.groupId,
    validatorRules.filename,
    validatorRules.fileType,
    validatorRules.file,
    validator,
    (req, res) => {
        uploadImg(req.body.groupId, req.body.filename, req.body.fileType, req.body.file, 2, res)
    }
)
//#endregion
