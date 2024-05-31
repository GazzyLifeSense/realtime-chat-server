module.exports = {
    SUCCESS: { code: 200, msg: "操作成功" },
    
    NEED_LOGIN: {code:401, msg:"身份无效，请登录后操作"},
    BAN: {code:402, msg:'账号被封禁'},
    NO_OPERATOR_AUTH: { code: 403, msg: "无权限操作" },
    
    SYSTEM_ERROR: {code:500, msg:"系统错误"},
    USERNAME_EXIST: {code:501, msg:"用户名已存在"},
    FAIL: {code:502, msg:"操作失败"},
    LOGIN_ERROR: {code:505, msg:"用户名或密码错误"},
    TARGET_CANNOT_EMPTY: {code:506, msg:"目标不能为空"},
    DUPLICATE_OPERATE: {code:507, msg:"重复操作"},
    TARGET_NOT_EXIST: {code:508, msg:"目标不存在"},
    INVALID_OPERATE: { code: 509, msg: "操作非法" },
    FILETYPE_NOT_SUPPORT: {code:516, msg:"文件类型不受支持"},
    NOT_MODIFIED: {code:517, msg:"未修改"},
    NOT_DELETED: {code:518, msg:"未删除"},

    PARAM_INVALID: {code: 999, msg:"参数非法"}
}