const mongoose = require('mongoose');
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/tetris';

const connectDB = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('MongoDB Conectado com Sucesso.');
    } catch (err) {
        console.error('Erro ao conectar ao MongoDB:', err.message);
        // Termina o processo com falha
        process.exit(1);
    }
};

module.exports = connectDB;