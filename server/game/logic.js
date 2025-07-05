const PIECES = {
    'T': {
        shape: [[1, 1, 1], [0, 1, 0]],
        color: 'purple',
    },
    'L': {
        shape: [[0, 0, 2], [2, 2, 2]],
        color: 'orange',
    },
    'J': {
        shape: [[3, 0, 0], [3, 3, 3]],
        color: 'blue',
    },
    'S': {
        shape: [[0, 4, 4], [4, 4, 0]],
        color: 'green',
    },
    'Z': {
        shape: [[5, 5, 0], [0, 5, 5]],
        color: 'red',
    },
    'I': {
        shape: [[6, 6, 6, 6]],
        color: 'cyan',
    },
    'O': {
        shape: [[7, 7], [7, 7]],
        color: 'yellow',
    }
};
const PIECE_TYPES = Object.keys(PIECES);

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;

// Cria um tabuleiro de jogo vazio
const createEmptyBoard = () => ({
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    // 0 = Célula vazia
    grid: Array(BOARD_HEIGHT).fill(0).map(() => Array(BOARD_WIDTH).fill(0))
});

// Gera uma peça aleatória
const generateRandomPiece = () => {
    const type = PIECE_TYPES[Math.floor(Math.random() * PIECE_TYPES.length)];
    const piece = PIECES[type];
    return {
        type: type,
        shape: piece.shape,
        color: piece.color,
        x: Math.floor(BOARD_WIDTH / 2) - Math.floor(piece.shape[0].length / 2),
        y: 0
    };
};

module.exports = {
    PIECES,
    PIECE_TYPES,
    BOARD_WIDTH,
    BOARD_HEIGHT,
    createEmptyBoard,
    generateRandomPiece
};