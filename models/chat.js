
let mongoose = require('../config/database')
const chatSchema = new mongoose.Schema({
    from: {type: mongoose.Types.ObjectId, required: true}, // 发送用户的id
    to: {type: mongoose.Types.ObjectId, required: true}, // 接收用户的id
    content: {type: String, default: ''}, // 内容
    type: {type: Number, required: true}, // 1 私聊    2 群聊
    isPic: {type: Number, default: 0}, // 图片类型
    create_time: Number // 创建时间
})

const Chat = mongoose.model('chat', chatSchema)

module.exports = {chatSchema, Chat}