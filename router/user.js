const { app } = require('@/server')
// 参数校验中间件
const { validatorRules, validator } = require('@/middleware/validator')
// 权限校验中间件
const PermissionMiddleware = require('@/middleware/permission')
// multipart
var multipart = require('connect-multiparty');
var multipartMiddleware = multipart({ maxFieldsSize: 5 * 1024 * 1024 });
// api
const { login, adminLogin, register, verifyAndGetUser, updateNickname, updateIntroduction, updatePassword } = require('@/service/User');
const { applyFriend, applyGroup, hasApplies, getFriendApplies, getGroupApplies, removeApply } = require('@/service/Applies');
const { addFriend } = require('@/service/Friend');
const { addGroup } = require('@/service/Group');
const { uploadImg } = require('@/service/Upload');

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
    PermissionMiddleware.AuthByUserId,
    (req, res)=>{
        updateNickname(req.body.userId, req.body.nickname, res)
    }
);
// 修改个人介绍
app.post('/updateIntroduction', 
    validatorRules.userId,
    validatorRules.introduction,
    validator,
    PermissionMiddleware.AuthByUserId,
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
    PermissionMiddleware.AuthByUserId,
    (req, res)=>{
        updatePassword(req.body.userId, req.body.password, req.body.newPassword, res)
    }
);
// 上传用户头像
app.post('/uploadAvatar', 
    multipartMiddleware, 
    validatorRules.userId,
    validatorRules.filename,
    validatorRules.fileType,
    validatorRules.file,
    validator,
    PermissionMiddleware.AuthByUserId, 
    (req, res)=>{
        uploadImg(req.body.userId, req.body.filename, req.body.fileType, req.body.file, 0, res)
    }
)
//#endregion

//#region 申请相关
app.post('/hasApplies', 
    validatorRules.userId,
    validator,
    PermissionMiddleware.AuthByUserId,
    (req, res)=>{
        hasApplies(req.body.userId, res)
    }
)
app.post('/getFriendApplies', 
    validatorRules.userId,
    validator,
    PermissionMiddleware.AuthByUserId,
    (req, res)=>{
        getFriendApplies(req.body.userId, res)
    }
)
app.post('/getGroupApplies',
    validatorRules.userId,
    validator,
    PermissionMiddleware.AuthByUserId, 
    (req, res)=>{
        getGroupApplies(req.body.userId, res)
    }
)
// 拒绝好友申请
app.post('/rejectFriendApply', 
    validatorRules.from,
    validatorRules.userId,
    validator,
    PermissionMiddleware.AuthByUserId,
    (req, res)=>{
        removeApply(req.body.from, req.body.userId, 'friend', res, server)
})
// 拒绝群组申请
app.post('/rejectGroupApply', 
    validatorRules.from,
    validatorRules.groupId,
    validator,
    PermissionMiddleware.CheckOwnershipByGroupId,
    (req, res)=>{
        removeApply(req.body.from, req.body.groupId, 'group', res, server)
})
// 申请好友
app.post('/applyFriend',
    validatorRules.userId,
    validatorRules.username,
    validator,
    PermissionMiddleware.AuthByUserId, 
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
    PermissionMiddleware.AuthByUserId,
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
    PermissionMiddleware.AuthByUserId,
    (req, res)=>{
        addFriend(req.body.from, req.body.userId, res, server)
    }
)
// 接受群组申请
app.post('/acceptGroupApply', 
    validatorRules.from,
    validatorRules.groupId,
    validator,
    PermissionMiddleware.CheckOwnershipByGroupId,
    (req, res)=>{
        addGroup(req.body.from, req.body.groupId, res, server)
    }
)
//#endregion
