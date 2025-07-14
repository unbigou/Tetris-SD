const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;

const PIECES = {
    'I': { shape: [[1, 1, 1, 1]], color: 1 },
    'L': { shape: [[0, 0, 2], [2, 2, 2]], color: 2 },
    'J': { shape: [[3, 3, 3], [0, 0, 3]], color: 3 },
    'S': { shape: [[0, 4, 4], [4, 4, 0]], color: 4 },
    'Z': { shape: [[5, 5, 0], [0, 5, 5]], color: 5 },
    'T': { shape: [[6, 6, 6], [0, 6, 0]], color: 6 },
    'O': { shape: [[7, 7], [7, 7]], color: 7 }
};
const PIECE_TYPES = Object.keys(PIECES);

const createEmptyBoard = () => Array(BOARD_HEIGHT).fill(0).map(() => Array(BOARD_WIDTH).fill(0));

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

module.exports = { PIECES, BOARD_WIDTH, BOARD_HEIGHT, createEmptyBoard, generateRandomPiece };