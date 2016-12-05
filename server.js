var session = require('cookie-session');
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var ObjectId = require('mongodb').ObjectID;
// Use your own mlab user id and password!!!
var mongourl = 'mongodb://ouproject:$-enuSw3cr8S@ds119718.mlab.com:19718/ouproject123';

var express = require('express');

var bodyParser = require('body-parser');
var fileUpload = require('express-fileupload');
var app = express();

// middlewares
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: false
}));

app.set('view engine', 'ejs');

app.use('/', express.static('public'));

var SECRETKEY1 = 'I want to pass COMPS381F';
var SECRETKEY2 = 'Keep this to yourself';
app.use(session({
    name: 'session',
    keys: [SECRETKEY1, SECRETKEY2]
}));

app.get('/', function(req, res) {
    console.log(req.session);
    if (!req.session.authenticated) {
        res.redirect('/login');
    } else res.redirect('/home');
});


app.get("/login", function(req, res) {
    res.sendFile(__dirname + '/public/login.html');
});

app.post('/login', function(req, res) {
    MongoClient.connect(mongourl, function(err, db) {
        assert.equal(err, null);
        console.log('Connected to MongoDB\n');
        var username = req.body.username,
            password = req.body.password;
        if (username == "" || password == "") {
            console.log('wrong ac or pw');
            return res.redirect('/login');
        }

        finduser(db, username, function(results) {
            db.close();
            console.log('Disconnected to MongoDB\n');
            if (!results) {
                console.log('no ac');
                return res.redirect('/login');
            }
            if (results.password != password) {
                console.log('wrong pw');
                return res.redirect('/login');
            }
            req.session.authenticated = true;
            req.session.user = username;
            console.log(req.session.user);
            res.redirect('/home');
        });
    });
});



app.get("/register", function(req, res) {
    res.sendFile(__dirname + '/public/register.html');
});

app.post('/register', function(req, res) {
    MongoClient.connect(mongourl, function(err, db) {
        console.log('Connected to MongoDB');
        assert.equal(null, err);
        var username = req.body.username,
            password = req.body.password;
        findoneuser(db, username, function(user) {
            db.close();
            console.log('Disconnected to MongoDB');
            console.log(user.length);
            switch (user.length) {
                case 0:
                    MongoClient.connect(mongourl, function(err, db) {
                        console.log('Connected to MongoDB');
                        assert.equal(null, err);
                        createuser(db, username, password, function(result) {
                            db.close();
                            if (result.insertedId != null) {
                                res.status(200);
                                res.redirect('/login');
                            } else {
                                res.status(500);
                                res.redirect('/register');
                            }
                        });
                    });
                    break;
                default:
                    console.log('user already has!');
                    return res.redirect('/register');
            }
        });

    });
});


app.get("/logout", function(req, res) {
    req.session.authenticated = false;
    req.session.user = null;
    console.log(req.session.user);
    res.redirect('/login');
});


app.get("/home", function(req, res) {
    if (!req.session.authenticated) {
        return res.redirect('/login');
    }
    MongoClient.connect(mongourl, function(err, db) {
        assert.equal(err, null);
        console.log('Connected to MongoDB\n');
        findrestaurants(db, function(restaurants) {
            db.close();
            console.log('Disconnected MongoDB\n');
            res.render('home', {
                r: restaurants,
                user: req.session.user
            });
            //res.end();
        });
    });

});


app.get('/search', function(req, res) {
    if (!req.session.authenticated) {
        return res.redirect('/login');
    }
    res.sendFile(__dirname + '/public/search.html');
});

app.post('/search', function(req, res) {
    MongoClient.connect(mongourl, function(err, db) {
        assert.equal(err, null);
        console.log('Connected to MongoDB\n');
        var name = req.body.name,
            borough = req.body.borough,
            cuisine = req.body.cuisine;
        console.log(name);
        searchrestaurants(db, name, borough, cuisine, function(results) {
            db.close();
            console.log('Disconnected to MongoDB\n');
            console.log(results);
            console.log(name);
            res.render('search', {
                s: results
            });
        });
    });
});


function createuser(db, username, password, callback) {
    db.collection('user').insertOne({
        "userid": username,
        "password": password,
    }, function(err, result) {
        //assert.equal(err,null);
        if (err) {
            result = err;
            console.log("insertOne error: " + JSON.stringify(err));
        } else {
            console.log("Inserted _id = " + result.insertedId);
        }
        callback(result);
    });
}


function finduser(db, username, callback) {
    db.collection('user').findOne({
        userid: username
    }, function(err, result) {
        assert.equal(err, null);
        console.log('finduser() was successful');
        callback(result);
    });
}

function findoneuser(db, username, callback) {
    var user = [];
    db.collection('user').find({
        userid: username
    }, {
        userid: 1
    }, function(err, results) {
        assert.equal(err, null);
        console.log('findoneuser() was successful');
        results.each(function(err, doc) {
            if (doc != null) {
                user.push(doc);
            } else {
                callback(user);
            }
        });
    });
}

function findrestaurants(db, callback) {
    var restaurants = [];
    db.collection('restaurant').find({}, {
        name: 1,
        _id: 1
    }, (function(err, result) {
        assert.equal(err, null);
        console.log('findrestaurants() was successful');
        result.each(function(err, doc) {
            if (doc != null) {
                restaurants.push(doc);
            } else {
                callback(restaurants);
            }
        });
    }));
}

function searchrestaurants(db, name, borough, cuisine, callback) {
    var restaurants = [];
    if (name) {
        name = new RegExp(name);
    }
    if (borough) {
        borough = new RegExp(borough);
    }
    if (cuisine) {
        cuisine = new RegExp(cuisine);
    }
    db.collection('restaurant').find({
        $or: [{
            name: name
        }, {
            borough: borough
        }, {
            cuisine: cuisine
        }]
    }, {
        name: 1,
        _id: 1
    }, (function(err, result) {
        assert.equal(err, null);
        result.each(function(err, doc) {
            if (doc != null) {
                restaurants.push(doc);
            } else {
                callback(restaurants);
            }
        });
    }));
}


app.use(fileUpload());
app.get('/new', function(req, res) {
    if (!req.session.authenticated) {
        return res.redirect('/login');
    }
    res.sendFile(__dirname + '/public/new.html');
});

app.post('/create', function(req, res) {
    var file;

    if (!req.body.name) {
        res.sendFile(__dirname + '/public/createerror.html');
        return;
    }
  
    if (req.files.sampleFile == null) {
        file = "no";
    } else {
        var sampleFile;
        file = req.files.sampleFile;
    }
   
    MongoClient.connect(mongourl, function(err, db) {
        console.log('Connected to MongoDB');
        assert.equal(null, err);
        creater(db, req.body.name, req.body.cuisine, req.body.street, req.body.building, req.body.zipcode, req.body.lat, req.body.lon,
            file, req.session.user, req.body.borough,
            function(result) {
                db.close();
                if (result.insertedId != null) {

                    console.log("insertOne() was successful _id = " +
                        JSON.stringify(result.insertedId));
                    res.redirect('/read?id=' + result.insertedId);
                } else {
                    res.status(500);
                    res.end(JSON.stringify(result));
                }
            });
    });

});


app.get("/read", function(req, res) {
    if (!req.session.authenticated) {
        return res.redirect('/login');
    }
    MongoClient.connect(mongourl, function(err, db) {
        var bfile = null;
        var mimetype = null;
        assert.equal(err, null);
        console.log('Connected to MongoDB\n');
        var criteria = {
            "_id": ObjectId(req.query.id)
        };
        find1R(db, criteria, function(doc) {
            db.close();
            console.log('Disconnected MongoDB\n');
            if (doc != "no result") {
                if (!doc.rate) {
                    doc.rate = "no";
                }
                if (doc.photo == "0") {
                    doc.photo = "no";
                }
                if(doc.mimetype != "image/jpeg" || doc.mimetype != "image/png" || doc.mimetype != "image/gif" || doc.mimetype !="image/jpg"){
 doc.photo = "no";
}
                console.log(doc.photo);
                req.session.read = doc.user;
                res.render('read', {
                    name: doc.name,
                    cuisine: doc.cuisine,
                    street: doc.address.street,
                    building: doc.address.building,
                    zipcode: doc.address.zipcode,
                    lon: doc.address.coord[1],
                    lat: doc.address.coord[0],
                    mimetype: doc.mimetype,
                    photo: doc.photo,
                    id: req.query.id,
                    r: doc.rate,
                    user: doc.user,
                    borough: doc.borough
                });
            } else {
                res.write('<html><head><title>Read restaurant</title></head>');
                res.write('<body><h1>Read restaurant</h1>');
                res.write('<p>No result!!</p>');
                res.write('<a href="javascript:history.back()">Go Back</a>');
                res.end('</body></html>');

            }
        });
    });
});

app.get("/change", function(req, res) {
    if (!req.session.authenticated) {
        return res.redirect('/login');
    }
    if (req.query.id.length != "24") {
        return res.sendFile(__dirname + '/public/errorn.html');
    }
    MongoClient.connect(mongourl, function(err, db) {
        assert.equal(err, null);
        console.log('Connected to MongoDB\n');
        var criteria = {
            "_id": ObjectId(req.query.id)
        };
        find1R(db, criteria, function(doc) {
            db.close();
            console.log('Disconnected MongoDB\n');

            if (req.session.user != req.session.read) {
                res.write('<html><head><title>Edit restaurant</title></head>');
                res.write('<body><h1>Edit restaurant</h1>');
                res.write('<p>You do not have permission to edit restaurant.</p>');
                res.write('<a href="javascript:history.back()">Go Back</a>');
                res.end('</body></html>');
            } else if (doc.length == "0") {
                res.write('<html><head><title>Read restaurant</title></head>');
                res.write('<body><h1>Edit restaurant</h1>');
                res.write('<p>No result!!</p>');
                res.write('<a href="javascript:history.back()">Go Back</a>');
                res.end('</body></html>');
            } else {
                res.render('edit', {
                    name: doc.name,
                    cuisine: doc.cuisine,
                    street: doc.address.street,
                    building: doc.address.building,
                    zipcode: doc.address.zipcode,
                    lon: doc.address.coord[1],
                    lat: doc.address.coord[0],
                    id: req.query.id,
                    borough: doc.borough
                });
            }
        });
    });
});

app.post('/change', function(req, res) {
    app.use(fileUpload());
    var sampleFile;
    var e = {};
    if (req.body.name != null) {
        e['name'] = req.body.name;
    }
    if (req.body.cuisine != null) {
        e['cuisine'] = req.body.cuisine;
    }
    if (req.body.borough != null) {
        e['borough'] = req.body.borough;
    }
    if (req.body.street != null) {
        e['address.street'] = req.body.street;
    }
    if (req.body.building != null) {
        e['address.building'] = req.body.building;
    }
    if (req.body.zipcode != null) {
        e['address.zipcode'] = req.body.zipcode;
    }

    if (req.body.lat != null) {
        e['address.coord.0'] = req.body.lat;
    }
    if (req.body.lon != null) {
        e['address.coord.1'] = req.body.lon;
    }


    if (req.body.zipcode != null) {
        e['address.zipcode'] = req.body.zipcode;
    }
    if (req.files.sampleFile != null) {
        e['photo'] = new Buffer(req.files.sampleFile.data).toString('base64');
        e['mimetype'] = req.files.sampleFile.mimetype;
    }
    console.log(req.files.sampleFile.mimetype);
    if (req.files.sampleFile.mimetype == "application/octet-stream") {
        e['photo'] = "0";
        e['mimetype'] = "0";
    } else {
        e['photo'] = new Buffer(req.files.sampleFile.data).toString('base64');
        e['mimetype'] = req.files.sampleFile.mimetype;
    }

    MongoClient.connect(mongourl, function(err, db) {
        console.log('Connected to MongoDB');
        assert.equal(null, err);
        edit(db, req.body.id, e, function(result) {
            db.close();
            console.log('Disconnected MongoDB\n');
            if (result.acknowledged != false) {
                res.redirect('/read?id=' + req.body.id);
            } else {
                res.status(500);
                res.end(JSON.stringify(result));
            }
        });
    });

});


app.get("/delete", function(req, res, next) {

    if (!req.session.authenticated) {
        return res.redirect('/login');
    }
    if (req.query.id.length != "24") {
        return res.sendFile(__dirname + '/public/errorn.html');
    }
    if (req.session.user == req.session.read) {
        MongoClient.connect(mongourl, function(err, db) {
            assert.equal(err, null);
            console.log('Connected to MongoDB\n');
            remove(db, req.query.id, function(result) {
                db.close();
                console.log('Disconnected MongoDB\n');
                if (result.acknowledged != false) {
                    res.writeHead(200, {
                        "Content-Type": "text/html"
                    });
                    res.write('<html><head><title>Delete restaurant</title></head>');
                    res.write('<body><h1>Delete restaurant</h1>');
                    res.write('<p>Delete was successful</p>');
                    res.write('<a href="/home" class="button">Go to Home</a>');
                    res.end('</body></html>');
                } else {
                    res.status(500);
                    res.end(JSON.stringify(result));
                }

            });
        });
    } else {
        res.write('<html><head><title>Delete restaurant</title></head>');
        res.write('<body><h1>Delete restaurant</h1>');
        res.write('<p>You do not have permission to delete restaurant.</p>');
        res.write('<a href="javascript:history.back()">Go Back</a>');
        res.end('</body></html>');
    }
});




app.get("/rate", function(req, res) {
    if (!req.session.authenticated) {
        return res.redirect('/login');
    }
    if (req.query.id.length != "24") {
        return res.sendFile(__dirname + '/public/errorn.html');
    }
    MongoClient.connect(mongourl, function(err, db) {
        var bfile = null;
        var mimetype = null;
        assert.equal(err, null);
        console.log('Connected to MongoDB\n');
        var criteria = {
            "_id": ObjectId(req.query.id),
            rate: {
                $elemMatch: {
                    user: req.session.user
                }
            }
        };
        find1R(db, criteria, function(doc) {
            db.close();
            console.log('Disconnected MongoDB\n');
            if (doc == "no result") {
                res.writeHead(200, {
                    "Content-Type": "text/html"
                });
                res.write('<html><head><title>Rate restaurant</title></head>');
                res.write('<body><h1>Rate</h1>');
                res.write('<p>You can choose 0-10<p>');
                res.write('<form method="POST" action="/rate">');
                res.write('Rate');
                res.write('<input type="number" name="score" min="0" max="10" step="1" value="0">');
                res.write('<input type="hidden" name="id" value="' + req.query.id + '">');
                res.write('<input type="submit">');
                res.end('</form></body></html>');
            } else {
                res.write('<html><head><title>Rate restaurant</title></head>');
                res.write('<body><h1>Rate restaurant</h1>');
                res.write('<p>You can not rate again!!</p>');
                res.write('<a href="javascript:history.back()">Go Back</a>');
                res.end('</body></html>');
            }
        });
    });
});



app.post("/rate", function(req, res) {

    MongoClient.connect(mongourl, function(err, db) {
        assert.equal(err, null);
        console.log('Connected to MongoDB\n');
        var e = {};
        var r = {};

        if (req.body.score != null) {
            e['score'] = req.body.score;
            e['user'] = req.session.user;
            r['rate'] = e;
        }
        console.log(r);
        rate(db, req.body.id, r, function(result) {
            console.log('Disconnected MongoDB\n');
            if (result) {
                res.redirect('/read?id=' + req.body.id);
            } else {
                res.status(500);
                res.end(JSON.stringify(result));
            }

        });
    });

});

app.get("/api/read/:function/:word", function(req,res) {
        MongoClient.connect(mongourl, function(err, db) {
            switch(req.params.function) {
			case "name":
				assert.equal(err,null);
	    console.log('Connected to MongoDB\n');
	    var criteria = {"name": req.params.word};
            findNr(db,criteria,function(doc) {
	      db.close();
	      console.log('Disconnected MongoDB\n');
if(!doc=="no result")  {      
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(doc));
       }
else{
res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({}));

}
	    });
				break;
                        case "borough":
	assert.equal(err,null);
	    console.log('Connected to MongoDB\n');
	    var criteria = {"borough": req.params.word};
            findNr(db,criteria,function(doc) {
	      db.close();
	      console.log('Disconnected MongoDB\n');
if(!doc=="no result")  {      
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(doc));
       }
else{
res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({}));

}
	    });
break;
                      case "cuisine":
	assert.equal(err,null);
	    console.log('Connected to MongoDB\n');
	    var criteria = {"cuisine": req.params.word};
            findNr(db,criteria,function(doc) {
	      db.close();
	      console.log('Disconnected MongoDB\n');
if(!doc=="no result")  {      
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(doc));
       }
else{
res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({}));

}
	    });
break;

			default:
				res.writeHead(500, {"Content-Type": "text/plain"});
				res.write(parsedURL.pathname + " not available yet\n");
				res.end();
		}
});
});



app.post("/api/create", function(req, res) {
    MongoClient.connect(mongourl, function(err, db) {
        var newR = req.body;

        if (!req.body.name) {
            handleError(res, "Invalid user input", "Must provide a name.", 400);
        }

        db.collection('restaurant').insertOne(newR, function(err, doc) {
            var json;
            if (err) {
                res.setHeader('Content-Type', 'application/json');
                res.send(JSON.stringify({
                    status: failed
                }));
            } else {
                res.setHeader('Content-Type', 'application/json');
                res.send(JSON.stringify({
                    status: "ok",
                    _id: newR._id
                }));
            }
        });
    });
});

function creater(db, name, cuisine, street, building, zipcode, lat, lon,
    bfile, user, borough, callback) {
    var r = {}; // new restaurant to be inserted
    r['address'] = {};
    r['name'] = (name != null) ? name : null;
    r['borough'] = (borough != null) ? borough : null;
    r.address.street = (street != null) ? street : null;
    r.address.zipcode = (zipcode != null) ? zipcode : null;
    r.address.building = (building != null) ? building : null;
    r.address['coord'] = [];
    r.address.coord.push(lat);
    r.address.coord.push(lon);

    r['cuisine'] = (cuisine != null) ? cuisine : null;
    if (bfile.mimetype == "application/octet-stream") {
        r['photo'] = "0";
        r['mimetype'] = "0";
    } else {
        r['photo'] = new Buffer(bfile.data).toString('base64');
        r['mimetype'] = bfile.mimetype;
    }
    r['user'] = user;
    db.collection('restaurant').insertOne(r, function(err, result) {
        assert.equal(err, null);
        if (err) {
            result = err;
            console.log("insertOne error: " + JSON.stringify(err));
        } else {
            console.log("Inserted _id = " + result.insertedId);
        }
        callback(result);
    });
}


function find1R(db, criteria, callback) {
    db.collection('restaurant').findOne(criteria, function(err, result) {

        if (result) {
            //assert.equal(err,null);
            callback(result);
        } else {
            callback("no result")
        }
    });
}

function findNr(db, criteria, callback) {
    var restaurants = [];
    db.collection('restaurant').find(criteria, function(err, result) {
        assert.equal(err, null);
        result.each(function(err, doc) {
            if (doc != null) {
                restaurants.push(doc);
                callback(restaurants);
            } else {
                callback("no result");
            }
        });
    })
}


function edit(db, id, e, callback) {
    db.collection('restaurant').updateOne({
        "_id": ObjectId(id)
    }, {
        $set: e
    }, function(err, result) {
        assert.equal(err, null);
        if (err) {
            result = err;
            console.log("Update error: " + JSON.stringify(err));
        } else {
            console.log("Update _id = " + id);
        }
        callback(result);
    });
}

function rate(db, id, e, callback) {
    db.collection('restaurant').updateOne({
        "_id": ObjectId(id)
    }, {
        $push: e
    }, function(err, result) {
        assert.equal(err, null);
        if (err) {
            result = err;
            console.log("Update error: " + JSON.stringify(err));
        } else {
            console.log("Update _id = " + id);
        }
        callback(result);
    });
}


function remove(db, id, callback) {
    db.collection('restaurant').deleteOne({
            "_id": ObjectId(id)
        },
        function(err, result) {
            assert.equal(err, null);
            if (err) {
                result = err;
                console.log("Remove error: " + JSON.stringify(err));
            } else {
                console.log("Remove _id = " + id);
            }
            callback(result);
        });

}




app.listen(process.env.PORT || 8099);
