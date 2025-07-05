const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const connectDB = require('./database/connection');
const tetrisService = require('./services/tetrisService');

const PROTO_PATH = path.join(__dirname, './proto/tetris.proto');
const PORT = process.env.PORT || 9090;

// Carregar o ficheiro .proto
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});
const tetrisProto = grpc.loadPackageDefinition(packageDefinition).tetris;

const server = new grpc.Server();

// Adicionar o serviço ao servidor
server.addService(tetrisProto.Tetris.service, tetrisService);

// Iniciar o servidor
server.bindAsync(`0.0.0.0:${PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) {
        console.error('Erro ao iniciar o servidor:', err);
        return;
    }
    
    // Conectar à Base de Dados
    connectDB();
    
    server.start();
    console.log(`Servidor gRPC a correr na porta ${port}`);
});
