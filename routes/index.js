var express = require('express');
var router = express.Router();
var mysql = require('mysql');
var multer  = require('multer')
var Client = require('ftp');

var fs = require('fs'),
    path = require('path'),
    filePath = path.join(__dirname, '../cnt');

var config = require('../config/config');

var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads')
  },
  filename: function (req, file, cb) {
    console.log(file);
    var name = Date.now() + "-" + file.originalname;
    req.fname = name;
    cb(null, name);
  }
})

var upload = multer({ storage: storage }).single('img');

var connection = mysql.createConnection({
  host     : config.mysqlConfig.host,
  user     : config.mysqlConfig.user,
  password : config.mysqlConfig.password,
  database : config.mysqlConfig.database
});

connection.connect();

function queryDb(query, callback) {
  connection.query(query, function (error, results, fields) {
    callback(error, results, fields);
  });
}

function checkUser(req, res, next) {
  var xml = req.body;
  console.log(JSON.stringify(xml));
  var username = xml['SOAP-ENV:Envelope']['SOAP-ENV:Body'][0]['ns:callTXLife'][0]['callTXLifeRequest'][0]['TXLife'][0]['UserAuthRequest'][0]['UserLoginName'][0];

  console.log(username);

  queryDb('SELECT * FROM POC_TBL_USERS AS usr WHERE USERNAME=\'' + username + '\'', function (error, results, fields) {
    if (error) throw error;
    if (results.length > 0) {
      console.log('Users: ', results[0]);
      checkPolicy(req, res, next);
    } else {
      console.log('No user found!');
      render('user-err', req, res, next);
    }
  });
}

function checkPolicy(req, res, next) {
  var xml = req.body;
  console.log(JSON.stringify(xml));
  var polid = xml['SOAP-ENV:Envelope']['SOAP-ENV:Body'][0]['ns:callTXLife'][0]['callTXLifeRequest'][0]['TXLife'][0]['TXLifeRequest'][0]['OLifE'][0]['InquiryConsolidatedInformationData'][0]['MirPolId'][0]['MirPolIdBase'][0];

  console.log(polid);

  queryDb('SELECT * FROM POC_TBL_CIF_CLIENT_ACCOUNTS WHERE REFERENCE_NO=\'' + polid + '\'', function (error, results, fields) {
    if (error) throw error;
    if (results.length > 0) {
      console.log('Policy: ', results[0]);
      next();
    } else {
      console.log('No policy found!');
      render('policy-err', req, res, next);
    }
  });
}

function render(type, req, res, next) {
  var file = '/fail.xml';
  if(type == 'policy-err') {
    file = '/policyerr.xml';
  } else if(type == 'scss') {
    file = '/scss.xml';
  }

  fs.readFile(filePath + file, {encoding: 'utf-8'}, function(err,data){
      if (!err) {
          //console.log('received data: ' + data);
          res.writeHead(200, {'Content-Type': 'application/xml'});
          res.write(data);
          res.end();
      } else {
          console.log(err);
      }
  });
}

router.post('/TXLifeService', checkUser, function(req, res, next) {
    render('scss', req, res, next);
});

router.post('/TXLifeUpload', function(req, res, next) {
  upload(req, res, function (err) {
    console.log(req.fname);
    if (err) {
      return;
    }
    fs.readFile('./uploads/' + req.fname, function read(err, data) {
      if (err) {
          throw err;
      }
      var c = new Client();
      c.connect({ host: config.ftpConfig.host, user: config.ftpConfig.user, password: config.ftpConfig.password});

      c.on('ready', function() {
        c.put('./uploads/' + req.fname, '/var/www/html/imgs/' + req.fname, function(err) {
          c.end();
          if (err) {
            console.log(err);
            res.status(500).send({ error: "Upload failed" });
          } else {
            console.log("File transferred successfully!");
            res.status(200).send({ resp: "Upload success" });
          }
        });
      });
    });
  });
});

module.exports = router;
