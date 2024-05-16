let mongoose = require('../config/mongodb')

let userSchema = new mongoose.Schema({
    username: {type: String, require: true, unique: true} ,         // 用户名
    nickname: String,     // 别名
    avatar: {type: String, default: ''},      // 头像
    introduction: {type: String, default: ''},   // 个人介绍
    password: String,  // 密码的密文
    friends: [mongoose.Types.ObjectId], // 好友列表
    regDate: {type: Number, default: Date.now()},  // 注册时间
    location: {type: String, default: '未知'}, // 归属地
    isBanned: {type: Boolean, default: false}, // 
})
let User = mongoose.model('user', userSchema)
module.exports = {userSchema, User}