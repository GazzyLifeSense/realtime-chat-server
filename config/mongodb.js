let mongoose = require('mongoose')

mongoose.connection.once('connected',()=>{
    console.log("[Init]数据库连接成功！")})
    
let uri = process.env['MONGODB_URI'] 
mongoose.connect(uri, {family: 4})


module.exports = mongoose