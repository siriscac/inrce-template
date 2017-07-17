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
  req.username = username;
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

//UPDATE `POC_TBL_USERS` SET  `PHOTO_FILE_NAME` = "pho1.jpg" WHERE `USERNAME` =  "jeffery"

function updateUserPic(req, res, next){
  console.log("upload_query:" + 'UPDATE POC_TBL_USERS SET PHOTO_FILE_NAME = \'' + req.fname + '\' WHERE USERNAME = \'' + req.body.username + '\'');
  queryDb('UPDATE POC_TBL_USERS SET PHOTO_FILE_NAME = \'' + req.fname + '\' WHERE USERNAME = \'' + req.body.username + '\'', function (error, results, fields) {
    if (error) {
      console.log(error);
      render('phtfail', req, res, next);
    } else {
      console.log("upload_scss");
      updateUserAddress(req, res, next);
    }
  });
}

function updateUserAddress(req, res, next){
  var addr_line1 = req.body.ad1;
  var addr_line2 = req.body.ad2;
  var addr_line3 = req.body.ad3;
  var city = req.body.city;
  var province = req.body.province;
  var zip = req.body.zip;
  var country = req.body.country;
  getUserID(req.body.username, function(userid){
    console.log("query+ " + 'UPDATE POC_TBL_CIF_CLIENT_ADDRESSES SET ADDRESS_LINE_1 = \'' + addr_line1 + '\',ADDRESS_LINE_2 = \'' + addr_line2 + '\',ADDRESS_LINE_3 = \'' + addr_line3 + '\',CITY_NAME = \'' + city + '\',PROVINCE_NAME = \'' + province + '\',ZIP_CODE = \'' + zip + '\',COUNTRY_NAME = \'' + country + '\'' + 'WHERE ADDRESS_TYPE = \'HOME\' AND CIF_CLIENT_NO = \'' + userid + '\'');
    queryDb('UPDATE POC_TBL_CIF_CLIENT_ADDRESSES SET ADDRESS_LINE_1 = \'' + addr_line1 + '\',ADDRESS_LINE_2 = \'' + addr_line2 + '\',ADDRESS_LINE_3 = \'' + addr_line3 + '\',CITY_NAME = \'' + city + '\',PROVINCE_NAME = \'' + province + '\',ZIP_CODE = \'' + zip + '\',COUNTRY_NAME = \'' + country + '\'' + 'WHERE ADDRESS_TYPE = \'HOME\' AND CIF_CLIENT_NO = \'' + userid + '\'' , function (error, results, fields) {
      if (error) {
        console.log(error);
        render('dtfail', req, res, next);
      } else {
        console.log("upload_scss");
        console.log(results);
        render('phtscss', req, res, next);
      }
    });
  });
}

function getUserID(username, callback) {
  queryDb('SELECT * FROM POC_TBL_USERS WHERE USERNAME = \'' + username + '\'', function (error, results, fields) {
    if (error) {
      console.log(error);
    } else {
      console.log(JSON.stringify(results[0]));
      var b = JSON.parse(JSON.stringify(results[0]));
      console.log(b);
      callback(b.CIF_CLIENT_NO);
    }
  });
}

function render(type, req, res, next) {
  var file = '/fail.xml';
  if(type == 'policy-err') {
    file = '/policyerr.xml';
  } else if(type == 'scss') {
    file = '/scss.xml';
  } else if(type == 'phtscss') {
    file = '/phtscss.xml';
  } else if(type == 'phtfail') {
    file = '/phtfail.xml';
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
            render('phtfail', req, res, next);
          } else {
            console.log("File transferred successfully!");
            updateUserPic(req, res, next);
          }
        });
      });
    });
  });
});

module.exports = router;
