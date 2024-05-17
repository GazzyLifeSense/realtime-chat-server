const ipdb = require('ipip-ipdb')
var location = new ipdb.City('./ipipfree.ipdb')

module.exports = async function getLocation(req){
    // 获取IP
    var ip = req.ip || '';
    
    // 转为IPV4
    ip = ip.substr(ip.lastIndexOf(':')+1,ip.length);
    let region
    try{
        region = await location.findInfo(ip, 'CN').regionName
        if(region == '保留地址' || region == '本机地址'){
            region = '广东'
        }
    }catch(err){
        console.log(err)
        region = '其它'
    }
    return region
}