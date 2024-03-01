let mongoose = require('../config/database')

let groupSchema = new mongoose.Schema({
    name: {type: String, require: true},      // 标题
    description: {type: String, default: ''}, // 简介
    owner: mongoose.Types.ObjectId,      // 拥有人
    members: [mongoose.Types.ObjectId], // 群成员列表
    avatar: {type: String, default:''}, // 头像
    banner: {type: String, default:''}, // 横幅
    isRecommanded: {type: Boolean, default: false}, // 是否推荐
    type: String        // 类型
})
let Group = mongoose.model('group', groupSchema)
module.exports = {groupSchema, Group} 