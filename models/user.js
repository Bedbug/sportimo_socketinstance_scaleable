// get an instance of mongoose and mongoose.Schema
var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var userStats = new Schema({
    matchesVisited: { type: Number, default: 0 },
    matchesPlayed: { type: Number, default: 0 },
    cardsPlayed: { type: Number, default: 0 },
    cardsWon: { type: Number, default: 0 },
    prizesWon: { type: Number, default: 0 }
})

var UserSchema = new Schema({
    name: {
        type: String
        // ,required: true
    },
    username: {
        type: String,
        unique: true,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    picture: String,
    inbox: [{
        type: String,
        ref: 'messages'
    }],
    level: {type:Number, default:0},
    unread: Number,
    pushToken: String,
    country: { type: String, required: false },
    admin: Boolean,
    stats: mongoose.Schema.Types.Mixed
}, {
     timestamps: { updatedAt: 'lastActive' },
        toObject: {
            virtuals: true
        }, toJSON: {
            virtuals: true
        }
    });




module.exports = mongoose.model('users', UserSchema);