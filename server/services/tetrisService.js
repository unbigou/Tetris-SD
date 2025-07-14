const { v4: uuidv4 } = require('uuid');
const Redis = require('redis');
const gameLogic = require('../game/logic');
const { GameResult, PlayerRanking } = require('../database/models');

const redisClient = Redis.createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redisClient.on('error', (err) => console.log('Erro no Redis Client', err));
redisClient.connect();

const activeGames = new Map();
let waitingPlayer = null;

const broadcastGameState = (gameId) => {
    const game = activeGames.get(gameId);
    if (!game) return;

    const gameStateForProto = {
        game_id: gameId,
        status: game.gameState.status,
        player_states: game.gameState.players.map(p => ({
            player_info: { id: p.id, name: p.name },
            board: {
                width: gameLogic.BOARD_WIDTH,
                height: gameLogic.BOARD_HEIGHT,
                cells: p.board.flat()
            },
            score: p.score,
            next_piece_type: p.nextPiece.type
        })),
        winner_name: game.gameState.winnerName || undefined
    };

    game.playerStreams.forEach(stream => {
        if (!stream.destroyed) {
            stream.write(gameStateForProto);
        }
    });
};

const createNewGame = (player1, stream1, player2, stream2) => {
    const gameId = uuidv4();
    console.log(`A criar novo jogo ${gameId} entre ${player1.name} e ${player2.name}`);

    const createPlayerState = (player) => ({
        id: player.id,
        name: player.name,
        board: gameLogic.createEmptyBoard(),
        score: 0,
        currentPiece: gameLogic.generateRandomPiece(),
        nextPiece: gameLogic.generateRandomPiece(),
        isGameOver: false
    });

    const gameState = {
        id: gameId,
        status: 1, // PLAYING
        players: [createPlayerState(player1), createPlayerState(player2)],
        startTime: Date.now()
    };

    activeGames.set(gameId, { gameState, playerStreams: [stream1, stream2] });
    redisClient.set(`game:${gameId}`, JSON.stringify(gameState), { EX: 3600 });
    broadcastGameState(gameId);
};

const tetrisService = {
    joinGame(call) {
        const player = call.request;
        console.log(`${player.name} (ID: ${player.id}) juntou-se ao matchmaking.`);

        if (waitingPlayer && waitingPlayer.player.id !== player.id) {
            const p1 = waitingPlayer.player;
            const stream1 = waitingPlayer.stream;
            waitingPlayer = null;
            createNewGame(p1, stream1, player, call);
        } else {
            waitingPlayer = { player, stream: call };
            call.write({ status: 0 }); // WAITING_FOR_OPPONENT
        }

        call.on('cancelled', () => {
            console.log(`${player.name} cancelou a ligação.`);
            if (waitingPlayer && waitingPlayer.player.id === player.id) {
                waitingPlayer = null;
            }
        });
    },

    sendAction(call, callback) {
        // A lógica de ação do jogador (simplificada) seria implementada aqui.
        const { game_id, player_id } = call.request;
        const game = activeGames.get(game_id);
        if (!game) return callback();
        // TODO: Implementar a lógica real do jogo.
        broadcastGameState(game_id);
        callback();
    },

    async getRanking(call, callback) {
        try {
            const topPlayers = await PlayerRanking.find().sort({ totalWins: -1, highestScore: -1 }).limit(10);
            const response = {
                entries: topPlayers.map(p => ({
                    player_name: p.playerName,
                    total_wins: p.totalWins,
                    highest_score: p.highestScore,
                }))
            };
            callback(null, response);
        } catch (error) {
            callback(error);
        }
    }
};

module.exports = tetrisService;