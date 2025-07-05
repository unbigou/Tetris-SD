// Extrair os construtores dos ficheiros proto gerados
const { Player, PlayerAction, Empty } = proto.tetris;
const { TetrisClient } = proto.tetris;

// --- ELEMENTOS DO DOM ---
const loginScreen = document.getElementById('login-screen');
const gameScreen = document.getElementById('game-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const joinGameBtn = document.getElementById('join-game-btn');
const playerNameInput = document.getElementById('player-name-input');
const statusMessage = document.getElementById('status-message');
const winnerMessage = document.getElementById('winner-message');
const playAgainBtn = document.getElementById('play-again-btn');

// Canvas e Nomes
const canvas1 = document.getElementById('tetris-canvas-1');
const ctx1 = canvas1.getContext('2d');
const player1NameEl = document.getElementById('player1-name');
const player1ScoreEl = document.getElementById('player1-score');

const canvas2 = document.getElementById('tetris-canvas-2');
const ctx2 = canvas2.getContext('2d');
const player2NameEl = document.getElementById('player2-name');
const player2ScoreEl = document.getElementById('player2-score');

const nextPieceCanvas = document.getElementById('next-piece-canvas');
const nextCtx = nextPieceCanvas.getContext('2d');

// --- ESTADO GLOBAL DO CLIENTE ---
let client; // Cliente gRPC
let localPlayerId = `player-${Math.random().toString(36).substr(2, 9)}`;
let localPlayerName = '';
let gameId = null;
let stream = null; // Stream gRPC para receber atualizações

// --- CONFIGURAÇÕES DO JOGO ---
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const BLOCK_SIZE_MAIN = canvas1.width / BOARD_WIDTH;
const BLOCK_SIZE_NEXT = nextPieceCanvas.width / 4;
const COLORS = {
    'T': 'purple', 'L': 'orange', 'J': 'blue', 'S': 'green',
    'Z': 'red', 'I': 'cyan', 'O': 'yellow', 'GHOST': '#88888844'
};
const PIECE_SHAPES = { // Precisa de estar no cliente para desenhar a próxima peça
    'T': [[1, 1, 1], [0, 1, 0]], 'L': [[0, 0, 2], [2, 2, 2]],
    'J': [[3, 0, 0], [3, 3, 3]], 'S': [[0, 4, 4], [4, 4, 0]],
    'Z': [[5, 5, 0], [0, 5, 5]], 'I': [[6, 6, 6, 6]],
    'O': [[7, 7], [7, 7]]
};


// --- FUNÇÕES DE RENDERIZAÇÃO ---

function drawBoard(ctx, board) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    if (!board || !board.getCellsList) return;

    const cells = board.getCellsList();
    for (let y = 0; y < BOARD_HEIGHT; y++) {
        for (let x = 0; x < BOARD_WIDTH; x++) {
            const index = y * BOARD_WIDTH + x;
            if (cells[index] === 1) { // FILLED
                // A cor não vem no estado do tabuleiro, então usamos uma cor padrão
                drawBlock(ctx, x, y, '#e0e0e0', BLOCK_SIZE_MAIN);
            }
        }
    }
}

function drawNextPiece(pieceType) {
    const shape = PIECE_SHAPES[pieceType];
    const color = COLORS[pieceType];
    const ctx = nextCtx;
    
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (!shape) return;
    
    shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                drawBlock(ctx, x, y, color, BLOCK_SIZE_NEXT);
            }
        });
    });
}

function drawBlock(ctx, x, y, color, size) {
    ctx.fillStyle = color;
    ctx.fillRect(x * size, y * size, size, size);
    ctx.strokeStyle = '#000';
    ctx.strokeRect(x * size, y * size, size, size);
}

// --- LÓGICA DE COMUNICAÇÃO GRPC ---

function connectAndJoinGame() {
    localPlayerName = playerNameInput.value || 'Anónimo';
    statusMessage.textContent = 'A conectar ao servidor...';

    // Aponta para o proxy Envoy (que será explicado nas instruções)
    client = new TetrisClient('http://' + window.location.hostname + ':8080');

    const player = new Player();
    player.setId(localPlayerId);
    player.setName(localPlayerName);

    statusMessage.textContent = 'À procura de um oponente...';
    
    stream = client.joinGame(player, {});

    stream.on('data', (response) => {
        const status = response.getStatus();
        gameId = response.getGameId();
        
        if (status === 0 /* WAITING_FOR_OPPONENT */) {
            // Continua a esperar...
        } else if (status === 1 /* PLAYING */) {
            loginScreen.classList.remove('active');
            gameScreen.classList.add('active');
            
            // Atualizar o estado do jogo
            updateUI(response);

        } else if (status === 2 /* GAME_OVER */) {
            gameScreen.classList.remove('active');
            gameOverScreen.classList.add('active');
            winnerMessage.textContent = `O vencedor é ${response.getWinnerName()}!`;
            stream.cancel(); // Termina o stream
        }
    });

    stream.on('error', (err) => {
        console.error('Erro de Stream:', err);
        statusMessage.textContent = `Erro: ${err.message}. Tente recarregar a página.`;
    });

    stream.on('end', () => {
        console.log('Stream terminado.');
    });
}

function sendPlayerAction(actionType) {
    if (!gameId || !client) return;

    const action = new PlayerAction();
    action.setGameId(gameId);
    action.setPlayerId(localPlayerId);
    action.setAction(actionType);
    
    client.sendAction(action, {}, (err, response) => {
        if (err) {
            console.error('Erro ao enviar ação:', err);
        }
    });
}

function updateUI(gameState) {
    const playerStates = gameState.getPlayerStatesList();
    const localPlayerState = playerStates.find(p => p.getPlayerInfo().getId() === localPlayerId);
    const opponentState = playerStates.find(p => p.getPlayerInfo().getId() !== localPlayerId);

    if (localPlayerState) {
        player1NameEl.textContent = localPlayerState.getPlayerInfo().getName();
        player1ScoreEl.textContent = localPlayerState.getScore();
        drawBoard(ctx1, localPlayerState.getBoard());
        drawNextPiece(localPlayerState.getNextPieceType());
    }
    
    if (opponentState) {
        player2NameEl.textContent = opponentState.getPlayerInfo().getName();
        player2ScoreEl.textContent = opponentState.getScore();
        drawBoard(ctx2, opponentState.getBoard());
    }
}


// --- EVENT LISTENERS ---

joinGameBtn.addEventListener('click', () => {
    if (playerNameInput.value.trim() !== '') {
        connectAndJoinGame();
    } else {
        alert('Por favor, insira um nome.');
    }
});

playAgainBtn.addEventListener('click', () => {
    // Recarrega a página para uma nova sessão
    window.location.reload();
});


document.addEventListener('keydown', (e) => {
    if (gameScreen.classList.contains('active')) {
        switch (e.key) {
            case 'ArrowLeft':
                sendPlayerAction(0 /* MOVE_LEFT */);
                break;
            case 'ArrowRight':
                sendPlayerAction(1 /* MOVE_RIGHT */);
                break;
            case 'ArrowUp':
                sendPlayerAction(2 /* ROTATE */);
                break;
            case 'ArrowDown':
                sendPlayerAction(3 /* SOFT_DROP */);
                break;
            case ' ': // Espaço
                e.preventDefault();
                sendPlayerAction(4 /* HARD_DROP */);
                break;
        }
    }
});

// Inicialização
function init() {
    loginScreen.classList.add('active');
    gameScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
}

init();