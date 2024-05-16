// 参数校验
const { body, validationResult, Result } = require('express-validator');
// 统一校验规则
const validatorRules = {
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
    'isRecommended': body('isRecommended').isBoolean(),
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
// 参数校验中间件
const validator = (req, res, next)=>{
    const errors = validationResult(req);
    // 参数非法，拦截并返回错误信息
    if (!errors.isEmpty()) {
        return ResponseResult.errorResult(res, HttpCodeEnum.PARAM_INVALID, errors.array.toString())
    }
    next()
}

module.exports = { validatorRules, validator }