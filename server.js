require('dotenv').config()
require('express-async-errors')
require('module-alias').addAliases({
    "@": __dirname
})

const express = require('express');
const app = express();
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser')
const httpServer = require('http').createServer(app)
// 创建socket
const server = require('./service/socket.io.server')(httpServer)
const router = require('./router/index')
const ResponseResult = require("./models/ResponseResult.js")
const SystemError = require("@/Error/SystemError");
const CustomError = require('@/Error/CustomError');

// middleware
app.use(bodyParser.json({limit:'10mb'}))
app.use(bodyParser.urlencoded({ limit:'10mb', extended: true }));
// The extended option allows to choose between parsing the URL-encoded data with the querystring library (when false) or the qs library (when true). 
app.use(cors({ optionsSuccessStatus: 200 }));
// static file path
app.use(express.static(path.join(__dirname, 'public')));


// global uncaught exception handler
process.on('uncaughtException', function(err){
    if(err instanceof SystemError){
        ResponseResult.errorResult(err.res, err.httpCodeEnum)
    }else if(err instanceof CustomError){
        ResponseResult.errorResult(err.res, err.httpCodeEnum)
    }
    console.log(err.message, err.stack,err)
})



// open server
httpServer.listen(process.env['PORT'] || 3000, function(){
    console.log('[Init]服务器已开放在端口：' + this.address().port)
    router.init()
})

module.exports = { app, server }

