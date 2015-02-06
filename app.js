var express = require('express');
var _ = require('lodash');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var MongoStore = require('connect-mongo')(session);
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var protectedUrls = ['/create-post', '/post-edit'];

function isAuthorizated(req){
  return !!req.session.userName;
}

mongoose.connect('mongodb://localhost/blog');
var db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function (callback) {
  console.log('Success');
});

var routes = require('./routes/index');
var users = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.set('env', 'development');

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    key: 'my-blog',
    secret: '14b49df34d7',
    saveUninitialized: true,
    resave: false,
    store: new MongoStore({
        host: 'localhost',
        port: 27017,
        db: 'blog'
    })
}));

app.use('/', function(req, res, next){
    var authorizated = isAuthorizated(req);
    var redirect = false;

    _.each(protectedUrls, function(url){
        if(req.url.indexOf(url) !== -1 && !authorizated){
            redirect = true;
            return false;
        }
    });

    if(redirect){
        return res.redirect('/login');
    }

    next();
});

app.use('/', routes);
app.use('/users', users);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});


module.exports = app;
