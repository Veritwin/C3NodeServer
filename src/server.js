var express = require('express')
var bodyParser = require('body-parser')
var fs = require('fs')
var util = require('util');
var http = require('http')
var https = require('https')
var morgan = require('morgan')('dev')
var auth = require('basic-auth')
var path = require('path-extra')
var ospath = require('ospath')
var socketio = require('socket.io')
var cors = require('cors')

var propertiesFilePath = path.join(ospath.data(), 'coloredcoins-full-node', 'properties.conf')

// Look for argument specifying a configuration file
const cfgArgPrefix = '--config=';
if (process.argv.length > 2 && process.argv[2].startsWith(cfgArgPrefix)) {
  let cfgFilePath = process.argv[2].substr(cfgArgPrefix.length);

  if (!cfgFilePath.startsWith('/')) {
    cfgFilePath = path.join(process.env.PWD, cfgFilePath);
  }

  propertiesFilePath = cfgFilePath;
}

var config = require(path.join(__dirname, '/../utils/config.js'))(propertiesFilePath)
var parser = require(path.join(__dirname, '/../src/block_parser.js'))(config)
var router = require(path.join(__dirname, '/../router/router.js'))
var sockets = require(path.join(__dirname, '/../utils/sockets.js'))

var sslCredentials
if (config.server.usessl && config.server.privateKeyPath && config.server.certificatePath) {
  try {
    var privateKey = fs.readFileSync(config.server.privateKeyPath, 'utf8')
    var certificate = fs.readFileSync(config.server.certificatePath, 'utf8')
    sslCredentials = {key: privateKey, cert: certificate}
  } catch (e) {}
}

var launchServer = function (type) {
  var server = (type === 'https') ? https.createServer(sslCredentials, app) : http.createServer(app)
  var port = (type === 'https') ? config.server.httpsPort : config.server.httpPort
  var io = socketio(server)

  sockets({
    io: io,
    emitter: parser.emitter
  })

  server.listen(port, config.server.host, function () {
    console.log(type + ' server started on port', port)
    app.emit('connect', type)
  })
  server.on('error', function (err) {
    console.error('err = ', err)
    process.exit(-1)
  })
}

var app = express()
app.use(cors())
app.use(morgan)
app.use(bodyParser.json())                              // Support for JSON-encoded bodies
app.use(bodyParser.urlencoded({ extended: true }))      // Support for URL-encoded bodies

if (config.server.useBasicAuth && config.server.userName && config.server.password) {
  app.use(function (req, res, next) {
    var basicAuthCredentials = auth(req)
    if (!basicAuthCredentials || basicAuthCredentials.name !== config.server.userName || basicAuthCredentials.pass !== config.server.password) {
      res.statusCode = 401
      res.setHeader('WWW-Authenticate', 'Basic realm=""')
      res.end('Access denied')
    } else {
      next()
    }
  })
}

router(app, parser)

app.use(function (req, res, next) {
  res.status(404)
  if (req.accepts('json')) return res.send({ error: 'Not found' })
  res.type('txt').send('Not found')
})

if (config.parser.start) {
  console.log('Starting parser...');

  const lastInfo = {};

  parser.parse(function (info) {
    let readInfo;

    if (info.hasOwnProperty('blocks') && info.hasOwnProperty('ccheight')) {
      if (info.blocks !== lastInfo.blocks || info.ccheight !== lastInfo.ccheight) {
        readInfo = {
          blocks: lastInfo.blocks = info.blocks,
          ccheight: lastInfo.ccheight = info.ccheight
        };
      }
    }
    else {
      readInfo = info;
    }

    if (readInfo) {
      console.log(util.format('%s - info', new Date().toISOString(), readInfo))
    }
  })
}

if (config.server.start) {
  console.log('Starting server...');
  if (sslCredentials) {
    launchServer('https')

    if (config.server.useBoth) {
      launchServer('http')
    }
  } else {
    launchServer('http')
  }
}