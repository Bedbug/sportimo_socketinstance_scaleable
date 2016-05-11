'use strict';
var mongoose = require('mongoose'),
  Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId;


var fields = {
    userid: String,
    matchesVisited: Number,
    matchesPlayed: Number,
    cardsPlayed: Number,
    cardsWon:Number,
    prizesWon:Number
};
var schema = new Schema(
    fields,
{
    timestamps: {updatedAt: 'lastActive' }
});

// Assign a method to create and increment stats
schema.methods.UpsertStat = function (uid, statChange, cb) {
  return this.model('userStats').findOneAndUpdate({ userid: uid }, { $set: { $inc: statChange } },{upsert:true}, cb);
}


module.exports =  mongoose.model('userStats', schema);
