const { Player, PlayerAction } = proto.tetris;
const { TetrisClient } = proto.tetris;

// --- Elementos do DOM ---
const screens = {
    login: document.getElementById('login-screen'),
    game: document.getElementById('game-screen'),
    gameOver: document.getElementById('game-over-screen'),
};
const joinGameBtn = document.getElementById('join-game-btn');
const playerNameInput = document.getElementById('player-name-input');
const statusMessage = document.getElementById('status-message');
const winnerMessage = document.getElementById('winner-message');
const playAgainBtn = document.getElementById('play-again-btn');

const player1NameEl = document.getElementById('player1-name');
const player1ScoreEl = document.getElementById('player1-score');
const canvas1 = document.getElementById('tetris-canvas-1');
const ctx1 = canvas1.getContext('2d');

const player2NameEl = document.getElementById('player2-name');
const player2ScoreEl = document.getElementById('player2-score');
const canvas2 = document.getElementById('tetris-canvas-2');
const ctx2 = canvas2.getContext('2d');

const nextPieceCanvas = document.getElementById('next-piece-canvas');
const nextCtx = nextPieceCanvas.getContext('2d');

// --- Estado do Cliente ---
let client;
let localPlayerId = `player-${Math.random().toString(36).substr(2, 9)}`;
let localPlayerName = '';
let gameId = null;
let stream = null;

// --- Configurações do Jogo ---
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const BLOCK_SIZE = canvas1.width / BOARD_WIDTH;
const COLORS = ['#000', '#00ffff', '#ffa500', '#0000ff', '#00ff00', '#ff0000', '#800080', '#ffff00'];
const PIECE_SHAPES = {
    'I': [[1, 1, 1, 1]], 'L': [[0, 0, 2], [2, 2, 2]], 'J': [[3, 3, 3], [0, 0, 3]],
    'S': [[0, 4, 4], [4, 4, 0]], 'Z': [[5, 5, 0], [0, 5, 5]], 'T': [[6, 6, 6], [0, 6, 0]],
    'O': [[7, 7], [7, 7]]
};

// --- Funções de Renderização ---
function drawBlock(ctx, x, y, colorIndex, size) {
    ctx.fillStyle = COLORS[colorIndex];
    ctx.fillRect(x * size, y * size, size, size);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.strokeRect(x * size, y * size, size, size);
}

function drawBoard(ctx, board) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (!board || !board.getCellsList) return;
    const cells = board.getCellsList();
    for (let y = 0; y < BOARD_HEIGHT; y++) {
        for (let x = 0; x < BOARD_WIDTH; x++) {
            const colorIndex = cells[y * BOARD_WIDTH + x];
            if (colorIndex > 0) {
                drawBlock(ctx, x, y, colorIndex, BLOCK_SIZE);
            }
        }
    }
}

function drawNextPiece(pieceType) {
    const shape = PIECE_SHAPES[pieceType];
    const colorIndex = COLORS.indexOf(PIECE_SHAPES[pieceType]?.color);
    nextCtx.clearRect(0, 0, nextCtx.canvas.width, nextCtx.canvas.height);
    if (!shape) return;
    shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                drawBlock(nextCtx, x + 0.5, y + 0.5, value, BLOCK_SIZE);
            }
        });
    });
}

// --- Lógica de Comunicação ---
function switchScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    if (screens[screenName]) {
        screens[screenName].classList.add('active');
    }
}

function connectAndJoinGame() {
    localPlayerName = playerNameInput.value || 'Anónimo';
    statusMessage.textContent = 'A conectar ao servidor...';
    client = new TetrisClient(`http://${window.location.hostname}:8080`);

    const player = new Player();
    player.setId(localPlayerId);
    player.setName(localPlayerName);

    statusMessage.textContent = 'À procura de um oponente...';
    stream = client.joinGame(player, {});

    stream.on('data', (response) => {
        const status = response.getStatus();
        gameId = response.getGameId();
        
        if (status === 0) { /* WAITING_FOR_OPPONENT */ }
        else if (status === 1) { /* PLAYING */
            switchScreen('game');
            updateUI(response);
        } else if (status === 2) { /* GAME_OVER */
            switchScreen('gameOver');
            winnerMessage.textContent = `O vencedor é ${response.getWinnerName()}!`;
            stream.cancel();
        }
    });

    stream.on('error', (err) => {
        statusMessage.textContent = `Erro: ${err.message}. Recarregue a página.`;
    });
}

function sendPlayerAction(actionType) {
    if (!gameId || !client) return;
    const action = new PlayerAction();
    action.setGameId(gameId);
    action.setPlayerId(localPlayerId);
    action.setAction(actionType);
    client.sendAction(action, {}, (err) => {
        if (err) console.error('Erro ao enviar ação:', err);
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

// --- Event Listeners ---
joinGameBtn.addEventListener('click', () => {
    if (playerNameInput.value.trim()) {
        connectAndJoinGame();
    } else {
        alert('Por favor, insira um nome.');
    }
});

playAgainBtn.addEventListener('click', () => window.location.reload());

document.addEventListener('keydown', (e) => {
    if (screens.game.classList.contains('active')) {
        e.preventDefault();
        switch (e.key) {
            case 'ArrowLeft': sendPlayerAction(0); break;
            case 'ArrowRight': sendPlayerAction(1); break;
            case 'ArrowUp': sendPlayerAction(2); break;
            case 'ArrowDown': sendPlayerAction(3); break;
            case ' ': sendPlayerAction(4); break;
        }
    }
});

switchScreen('login');