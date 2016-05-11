'use strict';
var mongoose = require('mongoose'),
  Schema = mongoose.Schema,
  ObjectId = Schema.ObjectId;

var fields = {
    userid: String,
    room: String,
    visited: Date,
    isPresent: Boolean
};

var schema = new Schema(fields);

module.exports =  mongoose.model('userActivities', schema);
