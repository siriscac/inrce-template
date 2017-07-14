var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var mysql = require('mysql');
var bodyParser = require('body-parser');
require('body-parser-xml')(bodyParser);
var index = require('./routes/index');
var os = require('os');
var app = express();

app.use(logger('dev'));
app.use(bodyParser.xml());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

app.use('/PFTXLifeWebservices/services', index);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  console.log(err);
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.send(err);
});

app.listen(8080, function() {
  console.log("Web service listening on port 8080");
});

console.log(os.tmpdir())

module.exports = app;
