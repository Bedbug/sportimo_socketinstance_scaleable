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


var RedisIP = 'angelfish.redistogo.com';
var RedisPort = 9455;
var RedisAuth = 'd8deecf088b01d686f7f7cbfd11e96a9';

// Initialize and connect to the Redis datastore
var redis = require('redis');
var redisclient = redis.createClient(RedisPort, RedisIP);

redisclient.auth(RedisAuth, function (err) {
    if (err) { throw err; }
});

redisclient.on("error", function (err) {
    LOG("{''Error'': ''" + err + "''}");
});

redisclient.on("subscribe", function(channel,count){
    LOG("SOCKET INSTANCE subscribed to PUB/SUB channel");
});

redisclient.on("unsubscribe", function(channel,count){
    LOG("SOCKET unsubscribed from PUB/SUB channel");
});

redisclient.on("end", function () {
    console.log("{Connection ended}");
});

redisclient.subscribe("socketServers");

redisclient.on("message", function (channel, message) {
    if(message=="ping") {
        //console.log(process.pid+": Main Server heartbeat");
        return;
    }



    console.log(message);
    if(LogStatus>0) {
        var parsedobj = JSON.parse(message);


        var obj = {event:null};
        if(parsedobj.data)
            obj= parsedobj.data;



        if(obj.event == "user_subscribed"){
             for(var i = 0; i<users.length; i++)
             {
                 if(users[i].userid == obj.id){
                 users[i].socket.send(JSON.stringify({message:"You are logged out because someone else logged in with your account"}));
                  users[i].socket.send(JSON.stringify({logout:true}));
                 }
             }
            return;
        }


        //  console.log(obj)

        if(obj.event=="new_game_event")
            console.log(process.pid+": BroadCasting: "+ obj.data.match_id+" | "+ obj.data.minute +"' "+ obj.data.event_name);
        else if(obj.event == "message")
            console.log(process.pid+": BroadCasting: "+ obj.data.match_id+" | Message");
        else if(obj.event == "custom_questions")
            console.log(process.pid+": BroadCasting: "+ obj.data.match_id+" | Game Question");
    }
//{"id":18,"data":"{\"data\":{\"match_id\":203,\"home_score\":0,\"player2_name\":\"\",\"away_score\":2,\"which_half\":1,\"minute\":58,\"id\":\"1194\",\"team_logo\":\"al-ahly-120.png\",\"event_id\":1,\"event_name\":\"Goal\",\"player_name\":\"Abdel-Fadil\"},\"event\":\"new_game_event\"}"}
    // var obj = JSON.parse(message);

    // lastEventID++;
    // var evtData = {
    //     id: lastEventID,
    //     data: obj
    // };

    // // Change The Last Event of The Match
    // ActiveGames[obj.data.match_id] = evtData;
    io.broadcast(message);
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

function LOG(s)
{
    if(LogStatus > 1)
        console.log(new Date()+"["+process.pid+"]: "+s);
}

//-------------------------------------
//  Web Sockets / Notification System
//-------------------------------------
var io = new WebSocketServer({server: server});

io.broadcast = function(data) {
    //console.log("Clients: "+ this.clients.length+" | "+JSON.stringify(data));
    
    for (var i in this.clients)
        this.clients[i].send(data);
};



    io.on('connection', function(socket) {

        var user = addUser();

        // Heartbeat
        //var heartbeatTimeout;
        //
        //function sendHeartbeat () {
        //    if(socket){
        //        socket.send(JSON.stringify({users:users.length}));
        //        heartbeatTimeout = setTimeout(sendHeartbeat, 60000);
        //    }
        //}

        LOG("A user has connected");

        socket.on('subscribe', function (data,callback) {
            // Register user to to match channel
            
            if(user.userID == -1) LOG("This userid is empty");
            LOG(user.userID + " subscribed to:" + data.room);
            user.channelID = data.room;

            if (data.room > 0) {
                var evtData = {
                    event: "user_subscribed",
                    id: user.userID
                };
                redisclient.publish("socketServers", JSON.stringify(evtData));
             }
        });

        socket.on('unsubscribe', function (data){
            // Unregister user from match channel;
            LOG(user.userID+" unsubscribed from:"+ data.room);
            user.channelID = 0;
        });

        socket.on('close', function () {
            LOG("Client disconected");
            //clearTimeout(heartbeatTimeout);
            removeUser(user);
            //ChannelEntry.remove(user,function(err) { LOG("error:"+err); })
        });

        socket.on("message", function(data){

            var parsedData = JSON.parse(data);

            if(parsedData.id)
            {
                // for(var i = 0; i<users.length; i++)
                // {
                //     if(users[i].userid == parsedData.id){
                //     users[i].socket.send(JSON.stringify({message:"You are logged out because someone else logged in with your account"}));
                //      users[i].socket.send(JSON.stringify({logout:true}));
                //      //users[i].socket.disconnect();
                //     }
                // }

                user.userID = parsedData.id;

                //sendHeartbeat();
                LOG("Registered user in server with ID: "+ user.userID);

            }
            else if(parsedData.subscribe)
            {
                user.channelID = parsedData.subscribe;

                LOG(user.userID+" subscribed to: "+user.channelID);
            }
            else if (parsedData.unsubscribe)
            {
                LOG(user.userID+" unsubscribed from: "+ user.channelID);
                user.channelID = 0;

            }
            //      else if(parsedData.disconnect)
            //         {
            //             removeUser(user);
            //          socket.disconnect();
            //         }
        });
    });

app.get('/', function(req, res, next) {
    res.send(200, "All set");
});




//----------------------------------------
//              Users
//----------------------------------------
var users = [];
var usersCount = 0;
var addUser = function() {
    usersCount++; // Helps iding the user on remove
    var user = {};
    user.index = usersCount;
    user.userID = -1;
    users.push(user);
    return user;
};

var removeUser = function(user) {

    for(var i=0; i<users.length; i++) {
        if(user.index === users[i].index) {
            LOG("removed user: "+users[i].userID+ " with index: "+user.index);
            users.splice(i, 1);
            return;
        }
    }
};

// Heartbeat
var heartbeatTimeout = setInterval(sendHeartbeat, 20000);

function sendHeartbeat () {
    if(io && users)
        io.broadcast(JSON.stringify({users:users.length}));
}
