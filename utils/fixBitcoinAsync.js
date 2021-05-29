/**
 * Created by claudio on 2021-05-29
 */

const {Client} = require('bitcoin-async')

Client.prototype.cmd = function (method, params, callback) {
  var bitcoin_err = 0
  var counter = 0
  var new_callback
  if (Array.isArray(method)) {
    counter = method.length
    if (!counter) return callback()
    new_callback = function (err, data) {
      function cb(err) {
        if (err) {
          if (!(bitcoin_err++)) {
            return callback(err)
          }
        }
        else if (!(--counter)) {
          return callback()
        }
      }

      if (err) {
        if (!(bitcoin_err++)) {
          return callback(err)
        }
      }
      else {
        return params(data, cb)
      }
    }
    this.cmdDeprecated(method, new_callback)
  } else {
    new_callback = function (err, data) {
      if (err) return callback(err)
      return callback(null, data)
    }
    var args = params ? [].slice.call(params) : []
    args.unshift(method)
    args.push(new_callback)
    this.cmdDeprecated.apply(this, args)
  }
}