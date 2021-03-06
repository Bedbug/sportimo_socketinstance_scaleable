/*
 Socket Server Instance

 Copyright (c) RebelCrew Games 2014
 Author: Aris Brink

 Permission is hereby granted, free of charge, to any person obtaining
 a copy of this software and associated documentation files (the
 "Software"), to deal in the Software without restriction, including
 without limitation the rights to use, copy, modify, merge, publish,
 distribute, sublicense, and/or sell copies of the Software, and to
 permit persons to whom the Software is furnished to do so, subject to
 the following conditions:

 The above copyright notice and this permission notice shall be
 included in all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

 */

var _ = require('lodash'),
    mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

var mongoCreds = require('./config/mongoConfig');

// Setup MongoDB conenction
// var mongoConnection = 'mongodb://bedbug:a21th21@ds027835.mongolab.com:27835/sportimov2';

var mongoConnection = 'mongodb://'+mongoCreds.user+':'+mongoCreds.password+'@'+mongoCreds.url;

mongoose.connect(mongoConnection, function (err, res) {
    if (err) {
        console.log('ERROR connecting to: ' + mongoConnection + '. ' + err);
    } else {
        console.log("[Socket] MongoDB Connected.");
    }
});

var fields = {
    userid: String,
    room: String,
    visited: Date,
    isPresent: Boolean
};

var schema = new Schema(fields);
var userActivities = require('./models/userActivity');
var users = require('./models/user');
var leaderboard = require('./models/score');

var InstId = process.env.SERVO_ID ? process.env.SERVO_ID : process.pid;


// var redisCreds = { url: 'clingfish.redistogo.com', port: 9307, secret: '075bc004e0e54a4a738c081bf92bc61d', channel: "socketServers" };
var redisCreds = require('./config/redisConfig');
//var RedisIP = 'angelfish.redistogo.com';
//var RedisPort = 9455;
//var RedisAuth = 'd8deecf088b01d686f7f7cbfd11e96a9';

// Initialize and connect to the Redis datastore
var redis = require('redis');
var redisclient = redis.createClient(redisCreds.port, redisCreds.url);

var PublishChannel = null;
PublishChannel = redis.createClient(redisCreds.port, redisCreds.url);
PublishChannel.auth(redisCreds.secret, function (err) {
    if (err) {
        console.log(err);
    }
});


redisclient.auth(redisCreds.secret, function (err) {
    if (err) { throw err; }
});

redisclient.on("error", function (err) {
    LOG("{''Error'': ''" + err + "''}");
});

redisclient.on("subscribe", function (channel, count) {
    LOG("SOCKET INSTANCE subscribed to PUB/SUB channel");
});

redisclient.on("unsubscribe", function (channel, count) {
    LOG("SOCKET unsubscribed from PUB/SUB channel");
});

redisclient.on("end", function () {
    console.log("{Connection ended}");
});

redisclient.subscribe("socketServers");

redisclient.on("message", function (channel, data) {
    var objectdata = JSON.parse(data);

    if (!objectdata.admin && !objectdata.server && (objectdata.payload.type == 'Card_won' || objectdata.payload.type == 'Card_lost')) {
        console.log("---------------------------------------------------");
        console.log("[REDIS]");
        console.log(objectdata);
        console.log("---------------------------------------------------");
    }
    else
     console.log(objectdata);

    // Establishing payload
    var message = {};
    try {
        message = JSON.parse(data);
    }
    catch (err) {
        message = data;
    }

    if (message.server) {
        return;
    }

    // Should the message be distributed by web sockets?
    if (message.sockets) {
        var payload = message.payload;


        // Is the payload directed to specific user or users?
        // if (message.client) {
        //     // console.log("Sending a message to one client:"+message.client);
        //     var evalUser = findUser(message.client);

        //     if (evalUser) {
        //         // console.log("Found him");
        //         evalUser.wss.send(JSON.stringify(payload));
        //     }
        // } else
        if (message.clients) { // Loop all users
            _.each(message.clients, function (client) {
                if (client) {
                    var evalUser = findUser(client);
                    // console.log("Sending a message to client:" + client);
                    if (evalUser) {
                        console.log("Found in instance. Sending a message to client:" + client);
                        evalUser.wss.send(JSON.stringify(payload));
                    }
                }
            })
        }
        else
            io.broadcast(JSON.stringify(payload), message.admin, payload.room);

    }
    else {
        var payload = message.payload;
        // If we received a command from another instance to disconnect user with the provided id

        if (payload.type == "disconnect_user" && payload.data.pid != InstId) {
            // console.log(payload)
            var evalUser = findUser(payload.data.uid);
            if (evalUser)
                DisconnectUser(evalUser);
        }
    }

});

var WebSocketServer = require('ws').Server,
    http = require('http'),
    express = require('express'),
    app = express();
var server = http.createServer(app);
server.listen(process.env.PORT || 8080);

/* SOCKETS CODE */

//----------------
//  Server Vars
//----------------
var lastEventID = 0;
var LogStatus = 2;
var ActiveGames = {};

function LOG(s) {
    if (LogStatus > 1)
        console.log(new Date() + "[" + process.pid + "]: " + s);
}

//-------------------------------------
//  Web Sockets / Notification System
//-------------------------------------
var io = new WebSocketServer({ server: server });


io.broadcast = function (data, admin, room) {

    // console.log(data);

    _.each(instUsers, function (user) {
        if (admin != null) {
            if (user.admin == admin)
                if (user.wss)
                    user.wss.send(data);
        }
        else if (room) {
            if (user.room == room || user.room == "Administration")
                if (user.wss)
                    user.wss.send(data);
        }
        else
            user.wss.send(data);
    })

};

io.on('connection', function (socket) {

    var user;

    socket.on('close', function () {

        if (user) {
            userActivities.findOneAndUpdate({ user: user.uid, room: user.room }, { $set: { isPresent: false } }, function (err, result) {});
            LOG("Client disconected: ["+user.uid+"] "+user.uname);
            removeUser(user);
        }
    });

    socket.on("message", function (data) {

        // Establishing payload
        var payload = {};
        try {
            payload = JSON.parse(data);
        }
        catch (err) {
            payload = data;
        }

        if (payload.test) {
            console.log("Initiating Test:")
            setTimeout(function () {
                console.log("Start:")
                var evtData = {
                    sockets: true,
                    client: user.uid,
                    payload: {
                        time: new Date()
                    }
                }

                for (var i = 0; i < 2000; i++) {
                    evtData.payload.index = i;
                    PublishChannel.publish("socketServers", JSON.stringify(evtData));
                }
            }, 2000);
        }
        // console.log(payload);
        // If the request is for registration
        if (payload.register) {

            if (!payload.register.admin) {
                var userExists = findUser(payload.register.uid);

                if (userExists) {
                    DisconnectUser(userExists);
                }
            }
            var evtData = {
                sockets: false,
                payload: {
                    type: "disconnect_user",
                    data: {
                        pid: InstId,
                        uid: payload.register.uid
                    }
                }
            }

            PublishChannel.publish("socketServers", JSON.stringify(evtData));


            if (payload.register.admin) {
                // Register the new user
                user = {
                    uid: payload.register.uid,
                    uname: payload.register.uname,
                    room: "Administration",
                    admin: true,
                    wss: socket
                }
                LOG("Administrator " + user.uname + " with id: " + user.uid + " has been registered to this instance")
            }
            else {
                user = {
                    uid: payload.register.uid,
                    uname: payload.register.uname,
                    room: "Lobby",
                    admin: false,
                    wss: socket
                }
                LOG("User with id: " + user.uid + " has been registered to this instance")
            }

            instUsers.push(user);


        }
        else if (payload.subscribe) {
            // console.log(user);
            try {

                user.room = payload.subscribe.room;
                LOG(user.uid + " subscribed to:" + user.room);

                // Enter leaderboard entry with user data
                leaderboard.AddLeaderboardEntry(user.uid, user.room);

                // Update Activities and Stats
                users.findOneAndUpdate({ user: user.uid}, {$set:{ isOnline: true}},function(e,r){});
                userActivities.findOneAndUpdate({ user: user.uid, room: user.room }, { $set: { isPresent: true } }, { upsert: true }, function (err, result) {
                    if (err)
                        console.log(err);

                    if (!result) {
                        var stat = 'matchesVisited';
                        var statsPath = {};
                        statsPath['stats.' + stat] = 1;

                        mongoose.model('users').findByIdAndUpdate(user.uid, { $inc: statsPath }, { upsert: true }, function (err, result) {
                            if (err)
                                console.log(err);

                            // console.log(result);
                        });
                    };
                });
            }
            catch (err) {
                console.log(err.stack);
            }
        }
        else if (payload.unsubscribe) {
            try {
                LOG(user.uid + " unsubscribed from: " + user.room);
                users.findOneAndUpdate({ user: user.uid}, {$set:{ isOnline: false}},function(e,r){});
                userActivities.findOneAndUpdate({ user: user.uid, room: user.room }, { $set: { isPresent: false } }, function (err, result) {
                    if (err)
                        console.log(err);
                });
                user.room = "Lobby";
            }
            catch (err) {
                console.log(err.stack);
            }
        }

    });
});

app.get('/', function (req, res, next) {
    res.send(200, "All set");
});




//----------------------------------------
//              Users
//----------------------------------------
var instUsers = [];

var DisconnectUser = function (user) {

    // Disable it for now
    // return;

    var json = JSON.stringify({
        type: "disconnect_user",
        client: user.uid,
        data: { "message": { "en": "You logged in from another device. We are sorry but you can only have one active connection." } }
    });



    user.wss.send(json);
    user.wss.close(1008, "Duplicate connection found");
    removeUser(user);
}

var findUser = function (id) {
    return _.find(instUsers, { uid: id });
}

var removeUser = function (user) {
    LOG("Removed user: " + user.uid);
    instUsers = _.without(instUsers, user);

};

// Heartbeat with stats
var heartbeatTimeout = setInterval(sendHeartbeat, 20000);


function sendHeartbeat() {
    var roomCount = _.countBy(instUsers, function (obj) {
        return obj.room;
    });

    var result = _.map(roomCount, function (value, key) {
        return { room: String(key), count: value };
    });

    var stats = {
        instance: InstId,
        connections: io.clients.length,
        rooms: result
    }

    if (io && instUsers)
        io.broadcast(JSON.stringify(stats), false);

    var redisData = {
        sockets: true,
        // share this to all socket instances and to clients which are flagged admin
        admin: true,
        payload: {
            type: "socket_stats",
            system: true,
            data: stats
        }
    }

    PublishChannel.publish("socketServers", JSON.stringify(redisData));
}
