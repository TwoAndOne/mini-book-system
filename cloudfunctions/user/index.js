// 云函数入口文件
const cloud = require('wx-server-sdk')
const TcbRouter = require('tcb-router')

cloud.init()

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const app = new TcbRouter({ event })

  const handleAuth = async (ctx, next) => {
    let result = {}
    if (event.sessionId) {
      let currentTime = new Date().getTime() / 1000
      result = await db.collection('session').doc(event.sessionId).get()
      if (result.data && result.data.expireTime >= currentTime) {
        await next()
      } else {
        ctx.body = {
          code: '101',
          message: '登录失效',
          result: result.data
        }
      }
    } else {
      ctx.body = {
        code: '101',
        message: 'sessionId 缺失',
        result: result
      }
    }
    return
  }
  app.router('list', handleAuth, async (ctx) => {
    try {
      let result = await db.collection('user').field({
        username: true,
        userType: true,
        _id: true
      }).get()

      ctx.body = {
        code: 0,
        data: {
          list: result.data
        }
      }
    } catch (e) {
      console.error(e)
      ctx.body = {
        code: -1,
        data: {},
        message: '请求失败'
      }
    }
  })

  app.router('detail', handleAuth, async (ctx) => {
    try {
      let result = await db.collection('user').doc(event.id).get()

      ctx.body = {
        code: 0,
        data: {
          user: result.data
        }
      }
    } catch (e) {
      console.error(e)
      ctx.body = {
        code: -1,
        data: {},
        message: '请求失败'
      }
    }
  })

  app.router('add', handleAuth, async (ctx) => {
    try {
      let result1 = await db.collection('user').where({
        username: event.data.username
      }).count()

      if (result1.total > 0) {
        ctx.body = {
          code: -2,
          data: {},
          message: '该用户名已存在'
        }
        return
      }
      let result2 = await db.collection('user').add({
          data: event.data
      })

      ctx.body = {
        code: 0,
        data: {},
      }
    } catch (e) {
      console.error(e)
      ctx.body = {
        code: -1,
        data: {},
        message: '请求失败'
      }
    }
  })

  app.router('edit', handleAuth, async (ctx) => {
    try {
      let result = await db.collection('user').doc(event.id).update({
        data: {
          remark: event.remark,
          userType: event.userType
        }
      })
      ctx.body = {
        code: 0,
        data: {}
      }
    } catch (e) {
      console.error(e)
      ctx.body = {
        code: -1,
        data: {},
        message: '请求失败'
      }
    }
  })

  app.router('delete', handleAuth, async (ctx) => {
    try {
      let result = await db.collection('user').doc(event.id).remove()
      ctx.body = {
        code: 0,
        data: {},
      }
    } catch (e) {
      console.error(e)
      ctx.body = {
        code: -1,
        data: {},
        message: '请求失败'
      }
    }
  })

  return app.serve()
}