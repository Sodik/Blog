var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var moment = require('moment');
var url = require('url');
var q = require('q');
var perPage = 5;

var Comment = mongoose.model('Comment', {
  post_id: Schema.Types.ObjectId,
  author: String,
  text: String,
  date: String,
  orderId: Number
});

var Post = mongoose.model('Post', {
    title: String,
    text: String,
    date: String,
    orderId: {
      type: Number,
      index: true
    }
});

var User = mongoose.model('User', {
  name: {
    type: String,
    unique: true
  },
  password: String,
});

function paginate(model, urlStr){
  var defer = q.defer();
  var query = url.parse(urlStr, true).query;

  model.count({}, function(err, count){
    if(err){
      defer.reject(err);
      return;
    }
    var pagesSize = Math.ceil(count/perPage);
    var currentPage;

    if(!query.p){
      model.find({}).limit(perPage).exec(function(err, posts){
        if(err){
          defer.reject(err);
          return;
        }
        defer.resolve({
          posts: posts,
          pages: pagesSize,
          currentPage: currentPage || 1
        });
      });
    }else{
      currentPage = parseInt(query.p);
      model.find({orderId: {$lte: currentPage * perPage, $gte: (currentPage-1) * perPage }}, function(err, posts){
        if(err){
          defer.reject(err);
          return;
        }else{
          defer.resolve({
            posts: posts,
            pages: pagesSize,
            currentPage: currentPage || 1
          });
        }
      });
    }
  });

  return defer.promise;
}

function isAuthorizated(req){
  return !!req.session.userName;
}

User.schema.path('name').validate(function(val){
  return !!val
}, "Name can't be empty");

User.schema.path('password').validate(function(val){
  return !!val;
}, "Password can't be empty");

Post.schema.path('title').validate(function(val){
  return !!val
}, "Title can't be empty");

Post.schema.path('text').validate(function(val){
  return !!val;
}, "Text can't be empty");

function updteSession(req, res){
  req.session.userName = req.body['user-name'];
  req.session.authorized = true;
  res.redirect('/');
}

/* GET home page. */
router.get('/', function(req, res, next) {
  paginate(Post, req.url).then(function(data){
    res.render('index', {
      authorized: req.session.authorized,
      posts: data.posts,
      currentPage: data.currentPage,
      pages: data.pages
    });
  }, function(err){
    console.error(err);
  });
});

/* GET login */
router.get('/login', function(req, res, next){
  if(isAuthorizated(req)){
    return res.redirect('/');
  }
  res.render('login', {});
});

/*  GET logout */
router.get('/logout', function(req, res, next){
  req.session.destroy();
  res.redirect('/');
});

/* GET post by id */
router.get('/post/:id', function(req, res, next){
  Post.findOne({_id: req.params.id}, function(err, post){
    if(err){
      return console.error(err);
    }
    if(post){
      Comment.find({post_id:  req.params.id }, function(err, comments){
        if(err){
          return console.error(err);
        }
        res.render('post', {
          title: post.title,
          text: post.text,
          authorized: req.session.authorized,
          post_id: post._id,
          comments: comments });
        });
    }else{
      res.redirect('/error')
    }
  });
});

/* GET edit post by id */
router.get('/edit-post/:id', function(req, res, next){
  Post.findOne({_id: req.params.id}, function(err, post){
    if(err){
      return console.error(err);
    }
    if(post){
      res.render('edit-post', { title: post.title, text: post.text, authorized: req.session.authorized, post_id: post._id });
    }else{
      res.redirect('/error')
    }
  });
});

/* GET create new post */
router.get('/create-post', function(req, res, next){
	res.render('create-post', {authorized: req.session.authorized});
});

/* GET sign up */
router.get('/sign-up', function(req, res, next){
  res.render('sign-up');
});

/* POST create new post */
router.post('/create-post', function(req, res, next){
  Post.findOne({}, {}, {sort: {orderId: -1}}, function(err, lastPost){
    if(err){
      return console.error(err);
    }
    var post = new Post({
      title: req.body.title,
      text: req.body.text,
      date: moment.utc(new Date()).format(),
      orderId: lastPost ? lastPost.orderId + 1: 1
    });

    post.save(function(err){
      if(err){
        return console.error(err);
      }
      console.log('Saved');
      res.redirect('/');
    });
  });
});

/* POST edit post by id */
router.post('/edit-post/:id', function(req, res, next){
  Post.update({_id: req.params.id}, {title: req.body.title, text: req.body.text}, {}, function(err){
    if(err){
      return console.error(err);
    }
    res.redirect('/');
  });
});

/* POST login */
router.post('/login', function(req, res, next){
  User.findOne({name: req.body['user-name']}, function(err, user){
    if(err){
      return console.error(err);
    }
    if(user && user.password === req.body['user-password']){
      updteSession(req, res);
    }else{
      res.render('message', {message: 'Try login again or sign up'});
    }
  });
});

/* POST sign uo */
router.post('/sign-up', function(req, res, next){
  var user = new User({
    name: req.body['user-name'],
    password: req.body['user-password']
  });
  user.save(function(err){
    if(err){
      return console.error(err);
    }
    updteSession(req, res);
    console.log('Registered');
  });
});

/* POST create new comment */
router.post('/comment/:post_id', function(req, res, next){
  var comment = new Comment({
    post_id: mongoose.Types.ObjectId(req.params.post_id),
    author: req.body.author,
    text: req.body.comment,
    date: moment.utc(new Date()).format()
  });
  comment.save(function(err, item){
    if(err){
      return console.error(err);
    }
    res.redirect('/post/'+ req.params.post_id +'');
  });
});

router.get('/reset', function(req, res, next){
  mongoose.connection.collections['posts'].drop(function(err){
    if(err){
      console.error(err);
    }else{
      console.log('Droped');
    }
  });
});

router.get('/fill', function(req, res, next){
  var testIndex = 0;
  while(testIndex < 100000){
    var post = new Post({
      title: 'Post ' + testIndex,
      text: 'Text' + testIndex,
      date: moment.utc(new Date()).format(),
      orderId: testIndex + 1
    });
    post.save();
    testIndex++;
  }
  res.redirect('/');
});

module.exports = router;
