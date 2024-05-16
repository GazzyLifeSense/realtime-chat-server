const { app } = require('@/server')
// 参数校验中间件
const { validatorRules, validator } = require('@/middleware/validator')
// 权限校验中间件
const PermissionMiddleware = require('@/middleware/permission')
// api
const { getFriends, deleteFriend } = require('@/service/Friend');

//#region 好友
app.post('/getFriends', 
    validatorRules.userId,
    validator,
    PermissionMiddleware.AuthByUserId,
    (req, res)=>{
        getFriends(req.body.userId, res)
    }
)

app.post('/deleteFriend', 
    validatorRules.userId,
    validatorRules.to,
    validator,
    PermissionMiddleware.AuthByUserId,
    (req, res)=>{
        deleteFriend(req.body.userId, req.body.to, res)
    }
)
//#endregion