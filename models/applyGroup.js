let mongoose = require('../config/mongodb')
const applyGroupSchema = new mongoose.Schema({
    from:  {type:mongoose.Types.ObjectId, require: true},  // 申请人
    to:  {type:mongoose.Types.ObjectId, require: true}, // 群id
    owner:  {type:mongoose.Types.ObjectId, require: true} // 处理申请的人
})

const ApplyGroup = mongoose.model('applyGroup', applyGroupSchema)

module.exports = {applyGroupSchema, ApplyGroup}