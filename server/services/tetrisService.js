const { v4: uuidv4 } = require('uuid');
const Redis = require('redis');
const gameLogic = require('../game/logic');
const { GameResult, PlayerRanking } = require('../database/models');

const redisClient = Redis.createClient();
redisClient.on('error', (err) => console.log('Erro no Redis Client', err));
redisClient.connect();

// Armazena o estado das partidas e os streams dos jogadores
const activeGames = new Map(); // gameId -> { gameState, playerStreams: [stream, stream] }
let waitingPlayer = null; // Guarda informações do jogador que está à espera

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
                // Converte a grelha 2D para um array plano de CellState
                cells: p.board.flat().map(cell => cell > 0 ? 1 : 0) // 1 = FILLED, 0 = EMPTY
            },
            score: p.score,
            next_piece_type: p.nextPiece.type
        })),
        winner_name: game.gameState.winnerName || ''
    };
    
    // Envia o estado para todos os jogadores na partida
    game.playerStreams.forEach(stream => stream.write(gameStateForProto));
};


const createNewGame = (player1, stream1, player2, stream2) => {
    const gameId = uuidv4();
    console.log(`A criar novo jogo ${gameId} entre ${player1.name} e ${player2.name}`);

    const gameState = {
        id: gameId,
        status: 1, // PLAYING
        players: [
            { id: player1.id, name: player1.name, board: gameLogic.createEmptyBoard().grid, score: 0, currentPiece: gameLogic.generateRandomPiece(), nextPiece: gameLogic.generateRandomPiece() },
            { id: player2.id, name: player2.name, board: gameLogic.createEmptyBoard().grid, score: 0, currentPiece: gameLogic.generateRandomPiece(), nextPiece: gameLogic.generateRandomPiece() },
        ],
        startTime: Date.now()
    };
    
    activeGames.set(gameId, {
        gameState,
        playerStreams: [stream1, stream2]
    });
    
    // Armazena o estado inicial no Redis
    redisClient.set(`game:${gameId}`, JSON.stringify(gameState));

    broadcastGameState(gameId);
};

// Implementação dos métodos do serviço gRPC
const tetrisService = {
    joinGame(call) {
        const player = call.request;
        console.log(`${player.name} (ID: ${player.id}) juntou-se ao matchmaking.`);
        
        if (waitingPlayer) {
            // Encontrámos um par, começa o jogo
            const p1 = waitingPlayer.player;
            const stream1 = waitingPlayer.stream;
            const p2 = player;
            const stream2 = call;
            
            waitingPlayer = null; // Limpa a fila de espera
            createNewGame(p1, stream1, p2, stream2);

        } else {
            // Nenhum jogador à espera, este torna-se o jogador em espera
            waitingPlayer = { player, stream: call };
            // Envia um estado de "à espera" para o cliente
            call.write({
                game_id: '',
                status: 0, // WAITING_FOR_OPPONENT
                player_states: []
            });
        }

        call.on('cancelled', () => {
            console.log(`${player.name} cancelou a ligação.`);
            // Lógica para remover o jogador do jogo ou da fila de espera
            if (waitingPlayer && waitingPlayer.player.id === player.id) {
                waitingPlayer = null;
            }
            // Encontrar e terminar o jogo se o jogador estiver numa partida ativa
            // (Esta parte pode ser mais complexa)
        });
    },

    sendAction(call, callback) {
        const { game_id, player_id, action } = call.request;
        const game = activeGames.get(game_id);

        if (!game || game.gameState.status !== 1 /* PLAYING */) {
            // Jogo não encontrado ou já terminado
            return callback();
        }

        const playerState = game.gameState.players.find(p => p.id === player_id);
        if (!playerState) return callback();
        
        // TODO: Implementar a lógica real para cada ação (mover, rodar, etc.)
        // Isto é uma simplificação. A lógica real de colisão e movimento seria complexa.
        const piece = playerState.currentPiece;
        switch(action) {
            case 0: piece.x--; break; // MOVE_LEFT
            case 1: piece.x++; break; // MOVE_RIGHT
            case 3: piece.y++; break; // SOFT_DROP
            // ... outras ações
        }

        // Simulação de queda de peça e final de jogo
        piece.y++;
        if (piece.y > gameLogic.BOARD_HEIGHT - 2) {
            // Simplificação: fixa a peça e gera uma nova
            for (let y = 0; y < piece.shape.length; y++) {
                for (let x = 0; x < piece.shape[y].length; x++) {
                    if (piece.shape[y][x] !== 0) {
                        const boardY = piece.y + y;
                        const boardX = piece.x + x;
                        if(boardY < gameLogic.BOARD_HEIGHT && boardX < gameLogic.BOARD_WIDTH) {
                           playerState.board[boardY][boardX] = piece.shape[y][x];
                        }
                    }
                }
            }
            playerState.score += 10;
            playerState.currentPiece = playerState.nextPiece;
            playerState.currentPiece.x = Math.floor(gameLogic.BOARD_WIDTH / 2) - 1;
            playerState.currentPiece.y = 0;
            playerState.nextPiece = gameLogic.generateRandomPiece();

            // Lógica de Game Over (muito simplificada)
            if (playerState.score > 100) {
                game.gameState.status = 2; // GAME_OVER
                const winner = playerState;
                const loser = game.gameState.players.find(p => p.id !== player_id);
                game.gameState.winnerName = winner.name;
                
                // Salvar na base de dados
                const durationSeconds = Math.floor((Date.now() - game.gameState.startTime) / 1000);
                const result = new GameResult({
                    gameId: game_id,
                    players: game.gameState.players.map(p => ({ id: p.id, name: p.name, score: p.score })),
                    winnerName: winner.name,
                    durationSeconds: durationSeconds,
                });
                result.save().then(() => console.log(`Jogo ${game_id} guardado na DB.`));

                // Atualizar ranking
                const updateRanking = async (player, isWinner) => {
                    await PlayerRanking.findOneAndUpdate(
                        { playerName: player.name },
                        { 
                            $inc: { totalWins: isWinner ? 1 : 0 },
                            $max: { highestScore: player.score }
                        },
                        { upsert: true, new: true }
                    );
                };
                updateRanking(winner, true);
                updateRanking(loser, false);

                // Remover do Redis e dos jogos ativos
                redisClient.del(`game:${game_id}`);
                activeGames.delete(game_id);
            }
        }
        
        broadcastGameState(game_id);
        callback();
    },

    async getRanking(call, callback) {
        try {
            const topPlayers = await PlayerRanking.find()
                .sort({ totalWins: -1, highestScore: -1 })
                .limit(10);
                
            const response = {
                entries: topPlayers.map(p => ({
                    player_name: p.playerName,
                    total_wins: p.totalWins,
                    highest_score: p.highestScore,
                }))
            };
            callback(null, response);

        } catch (error) {
            console.error("Erro ao obter ranking:", error);
            callback(error);
        }
    }
};

module.exports = tetrisService;