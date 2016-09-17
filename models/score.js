'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

var fields = {
    user_id: { type: String },
    pic: { type: String },
    level: { type: Number, default: 0 },
    user_name: { type: String },
    game_id: { type: String },
    score: { type: Number, default: 0 },
    country: { type: String },
    created: { type: Date, default: Date.now }
};

var scoreSchema = new Schema(fields);

scoreSchema.statics.AddPoints = function (uid, room, points, cb) {

    return mongoose.model('scores').findOneAndUpdate({ game_id: room, user_id: uid },
        { $inc: { score: points } },
        { safe: true, new: true },
        function (err, result) {
            if (!err)
                console.log('passed scres with no error 1/2.');

            if (cb)
                return cb(err, result);
        });
}

// Internal method used by sockets subscribe
scoreSchema.statics.AddLeaderboardEntry = function (uid, room) {
    mongoose.model('users').findById(uid, function (err, user) {
        
        var score = new mongoose.models.scores({
            user_id: user._id,
            pic: user.picture,
            user_name: user.username,
            game_id: room,
            country: user.country,            
        });

        if(user.level)
        score.level= user.level;
        
        score = score.toObject();
        delete score._id;
        delete score.score;
        
        if (user) {
            mongoose.model('scores').findOneAndUpdate({ game_id: room, user_id: uid },
                score,
                { upsert: true, safe: true, new: true },
                function (err, result) {
                    if (err)
                        return console.log(err);

                        console.log("Added leaderboard entry for: "+uid);
                });
        }
    });


}

module.exports = mongoose.model('scores', scoreSchema);
