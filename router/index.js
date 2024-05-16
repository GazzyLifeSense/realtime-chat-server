const fs = require('fs')
const path = require('path')

module.exports = {
    init() {
        fs.readdirSync(path.join(process.cwd(), 'router')).forEach(moduleName => {
            if (moduleName != 'index.js') {
                require(path.join(process.cwd(), 'router', moduleName))
            }
        })
        console.log('[Init]路由初始化完成')
    }
}