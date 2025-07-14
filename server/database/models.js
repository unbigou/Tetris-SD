const mongoose = require('mongoose');

const GameResultSchema = new mongoose.Schema({
    gameId: { type: String, required: true, unique: true },
    players: [{ id: String, name: String, score: Number }],
    winnerName: { type: String, required: true },
    durationSeconds: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
});

const PlayerRankingSchema = new mongoose.Schema({
    playerName: { type: String, required: true, unique: true, index: true },
    totalWins: { type: Number, default: 0 },
    highestScore: { type: Number, default: 0 },
});

module.exports = {
    GameResult: mongoose.model('GameResult', GameResultSchema),
    PlayerRanking: mongoose.model('PlayerRanking', PlayerRankingSchema)
};