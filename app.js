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

var _ = require('lodash');

var redisCreds = { url: 'clingfish.redistogo.com', port: 9307, secret: '075bc004e0e54a4a738c081bf92bc61d', channel: "socketServers" };
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

    // Establishing payload
    var message = {};
    try {
        message = JSON.parse(data);
    }
    catch (err) {
        message = data;
    }

    if (message.server) return;
    // console.log(message);
    // Should the message be distributed by web sockets?
    if (message.sockets) {
        var payload = message.payload;

        // Is the payload directed to specific user?
        if (payload.client) {
            var evalUser = findUser(payload.client);
            if (evaluser)
                evalUser.wss.send(payload);
        }
        else
            io.broadcast(payload);

    }
    else {
        var payload = message.payload;
        // If we received a command from another instance to disconnect user with the provided id
        if (payload.type == "disconnect_user" && payload.data.pid != process.pid) {
            var evalUser = findUser(payload.data.uid);
            if (evalUser)
                DisconnectUser(evalUser);
        }
    }


    //    if(obj.event == "user_subscribed"){
    //         for(var i = 0; i<users.length; i++)
    //         {
    //             if(users[i].userid == obj.id){
    //             users[i].socket.send(JSON.stringify({message:"You are logged out because someone else logged in with your account"}));
    //              users[i].socket.send(JSON.stringify({logout:true}));
    //             }
    //         }
    //        return;
    //    }
    //
    //
    //    //  console.log(obj)
    //
    //    if(obj.event=="new_game_event")
    //        console.log(process.pid+": BroadCasting: "+ obj.data.match_id+" | "+ obj.data.minute +"' "+ obj.data.event_name);
    //    else if(obj.event == "message")
    //        console.log(process.pid+": BroadCasting: "+ obj.data.match_id+" | Message");
    //    else if(obj.event == "custom_questions")
    //        console.log(process.pid+": BroadCasting: "+ obj.data.match_id+" | Game Question");
    //}


});

// {"id":1,"data":"{\"id\":6,\"data\":\"{\\\"data\\\":{\\\"match_id\\\":202,\\\"home_score\\\":1,\\\"player2_name\\\":\\\"\\\",\\\"away_score\\\":0,\\\"which_half\\\":2,\\\"minute\\\":64,\\\"id\\\":\\\"1183\\\",\\\"team_logo\\\":\\\"th_BM.png\\\",\\\"event_id\\\":1,\\\"event_name\\\":\\\"Goal\\\",\\\"player_name\\\":\\\"Afobe (own)\\\"},\\\"event\\\":\\\"new_game_event\\\"}\"}"}


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


// wss.broadcast = function broadcast(data) {
//   wss.clients.forEach(function each(client) {
//     client.send(data);
//   });
// };

io.broadcast = function (data) {
    // console.log("Clients: "+ this.clients.length+" | "+JSON.stringify(data));

    for (var i in this.clients)
        this.clients[i].send(data);
};

io.on('connection', function (socket) {

    var user;
    console.log("Connected");

    socket.on('register', function (data, callback) {

        user = findUser(data.uid);
        console.log(user);

        if (!user) {
            user = {
                uid: data.uid,
                uname: data.uname,
                wss: socket
            }

            instUsers.push(user);
        }

        var evtData =
            {
                sockets: true,
                payload: {
                    type: "user_subscribed",
                    pid: process.pid,
                    id: user.uid
                }
            }

        PublishChannel.publish("socketServers", JSON.stringify(evtData));
        LOG("A user with id: " + user.uid + " has registered in this sockets Instance.");
    });

    socket.on('subscribe', function (data, callback) {
        user.room = data.room;
        LOG(user.uid + " subscribed to:" + data.room);
    });

    socket.on('unsubscribe', function (data) {
        // Unregister user from match channel;
        LOG(user.userID + " unsubscribed from:" + data.room);
        user.channelID = 0;
    });

    socket.on('close', function () {
        LOG("Client disconected");

        if (user)
            removeUser(user);

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

        // If the request is for registration
        if (payload.register) {

            var userExists = findUser(payload.register.uid);

            if (userExists) {
                DisconnectUser(userExists);
            }
            else {
                var evtData = {
                    sockets: false,
                    payload: {
                        type: "disconnect_user",
                        data: {
                            pid: process.pid,
                            id: payload.register.uid
                        }
                    }
                }
                PublishChannel.publish("socketServers", JSON.stringify(evtData));
            }


            // Register the new user
            user = {
                uid: payload.register.uid,
                uname: payload.register.uname,
                room: "Lobby",
                wss: socket
            }

            instUsers.push(user);


        }
        else if (payload.subscribe) {
            // console.log(user);
            user.room = payload.subscribe.room;
            LOG(user.uid + " subscribed to:" + user.room);
        }
        else if (payload.unsubscribe) {
            LOG(user.uid + " unsubscribed from: " + user.room);
            user.room = "Lobby";
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
var heartbeatTimeout = setInterval(sendHeartbeat, 30000);


function sendHeartbeat() {
    var roomCount = _.countBy(instUsers, function (obj) {
        return obj.room;
    });

    var result = _.map(roomCount, function (value, key) {
        return { room: String(key), count: value };
    });

    var stats = {
        instance: process.pid,
        connections: io.clients.length,
        rooms: result
    }

    if (io && instUsers)
        io.broadcast(JSON.stringify(stats));
}
