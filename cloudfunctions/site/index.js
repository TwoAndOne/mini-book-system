// 云函数入口文件
const cloud = require('wx-server-sdk')
const TcbRouter = require('tcb-router')
const MD5 = require("blueimp-md5")

cloud.init()

const db = cloud.database()
const _ = db.command
const ADMIN_USER = 1
const COMMON_USER = 0


// 云函数入口函数
exports.main = async (event, context) => {
  const app = new TcbRouter({ event })

  const checkAuth = (type) => {
    type = type || 0
    const handleAuth = async (ctx, next) => {
      try {
        let result = {}
        if (event.sessionId) {
          let currentTime = new Date().getTime() / 1000
          result = await db.collection('session').where({
            key: MD5(event.sessionId),
          }).get()
          let userType = result.data && result.data[0] && result.data[0].userType || 0
          if (type > userType) {
            ctx.body = {
              code: 403,
              message: 'Forbidden',
              result: result.data
            }
          } else if (result.data && result.data[0] && result.data[0].expireTime >= currentTime) {
            await next()
          } else {
            ctx.body = {
              code: 401,
              message: 'Unauthorized',
              result: result.data
            }
          }
        } else {
          ctx.body = {
            code: 401,
            message: 'Unauthorized',
            result: result
          }
        }
        return
      } catch (e) {
        ctx.body = {
          code: 500,
          message: 'Internal Server Error'
        }
      }
    }
    return handleAuth
  }
  
  app.router('login', async (ctx) => {
    try {
      let user = {}
      let result = await db.collection('user').where({
        username: event.user.username,
        password: MD5(event.user.password)
      }).get()

      if(result.data && result.data.length > 0){
        user = result.data[0]
        let time = new Date().getTime()/1000 + 24*60*60
        let r = 0
        let key = ''
        while(key.length < 10){
          r = (Math.random() + 1) * (Math.random() + 1)
          key = r.toString().split('.')[1]
        }
        let mKey = MD5(key)
        
        // 清除其他session记录
        let result2 = await db.collection('session').where({
          userId: user._id,
          key: _.neq(mKey)
        }).remove()

        let result3 = await db.collection('session').add({
          data: {
            expireTime: time,
            userId: user._id,
            userType: user.userType,
            key: mKey
          }
        })
        ctx.body = {
          code: 0,
          data: {
            sessionId: key,
            user: {
              userId: user._id,
              username: user.username,
              userType: user.userType,
              motto: user.motto
            }
          }
        }
        return
      }

      ctx.body = {
        code: 101,
        data: { result: result, user: user, length: result.data.length},
        message: '用户名/密码错误'
      }
    } catch (e) {
      console.error(e)
      ctx.body = {
        code: 500,
        message: 'Internal Server Error'
      }
    }
  })

  app.router('logout', async (ctx) => {
    try {
      // 清除session记录
      let result = await db.collection('session').doc(event.sessionId).remove()
      ctx.body = {
        code: 0,
        data: {
          user: result.data
        }
      }
    } catch (e) {
      console.error(e)
      ctx.body = {
        code: 500,
        message: 'Internal Server Error'
      }
    }
  })

  app.router('update-password', checkAuth(COMMON_USER), async (ctx) => {
    try {
      let result1 = await db.collection('user').where({
        _id: event.id,
        password: MD5(event.password)
      }).count()
      if (+result1.total === 1){
        let result2 = await db.collection('user').doc(event.id).update({
          data: {
            password: MD5(event.newPassword)
          }
        })
        ctx.body = {
          code: 0,
          data: {}
        }
      }else{
        ctx.body = {
          code: 1001,
          data: {},
          message: '当前密码错误'
        }
      }
    } catch (e) {
      console.error(e)
      ctx.body = {
        code: 500,
        message: 'Internal Server Error'
      }
    }
  })

  app.router('update-motto', checkAuth(COMMON_USER), async (ctx) => {
    try {
      let result = await db.collection('user').doc(event.id).update({
        data: {
          motto: event.motto
        }
      })
      ctx.body = {
        code: 0,
        data: result
      }
    } catch (e) {
      console.error(e)
      ctx.body = {
        code: 500,
        message: 'Internal Server Error'
      }
    }
  })

  return app.serve()
}