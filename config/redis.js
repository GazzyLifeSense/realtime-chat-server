const redis = require('redis')
require('dotenv').config()

let redisClient = redis.createClient({ url: process.env['REDIS_URI']})
redisClient.connect()

redisClient.once('connect',()=>{
    console.log("[Init]Redis连接成功！")})

redisClient.on('error', err => console.log('Redis Client Error', err));

module.exports = redisClient