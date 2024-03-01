let mongoose = require('../config/database')
const applyFriendSchema = new mongoose.Schema({
    from: {type:mongoose.Types.ObjectId, require: true},  // 申请人
    to: {type:mongoose.Types.ObjectId, require: true},  // 被申请人
})

const ApplyFriend = mongoose.model('applyFriend', applyFriendSchema)

module.exports = {applyFriendSchema, ApplyFriend}