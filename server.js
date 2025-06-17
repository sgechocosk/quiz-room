const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const rooms = {};

const PORT = 3000;

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('🔌 ユーザーが接続しました');

    function cleanupRoom(roomId) {
        const roomData = rooms[roomId];
        if (!roomData) return;
        
        if (roomData.participants.length === 0 && !roomData.hostId) {
            delete rooms[roomId];
            console.log(`🗑️ ルーム ${roomId} を削除しました`);
        }
    }

    // ルーム存在確認
    socket.on('check-room', ({ name, room }) => {
        const roomData = rooms[room];
        if (!roomData) {
            socket.emit('room-check-result', false);
            return;
        }

        // 名前重複チェックの改善
        const isDuplicate = roomData.participants.some(p => p.name.toLowerCase() === name.toLowerCase());
        if (isDuplicate) {
            socket.emit('name-unavailable');
            return;
        }

        // 参加者数制限（例：150人まで）
        if (roomData.participants.length >= 150) {
            socket.emit('room-full');
            return;
        }
    
        socket.join(room); // 部屋に参加(参加者)
        rooms[room].participants.push({ id: socket.id, name });
        socket.emit('buzz-list', rooms[room].buzzList);
        socket.emit('room-check-result', true);
    });    

    // ルーム作成
    socket.on("create-room", (room) => {
        if (rooms[room]) return;
        rooms[room] = {
            hostId: socket.id,
            participants: [],
            buzzList: []
        };
        socket.join(room); //部屋に参加(ホスト)
        io.to(room).emit('buzz-list', []);
        socket.emit("host-confirmed");
    });

    // ルームIDの重複確認
    socket.on("check-room-available", (roomId) => {
        if (rooms[roomId]) {
            socket.emit("room-unavailable");
        } else {
            socket.emit("room-available", roomId);
        }
    });

    // 早押し処理
    socket.on('buzz', ({ name, room }) => {
        const roomData = rooms[room];
        if (roomData && !roomData.buzzList.includes(name)) {
            roomData.buzzList.push(name);
            io.to(room).emit('buzz-list', roomData.buzzList);
        }
    });

    // リセット
    socket.on('reset', (room) => {
        if (rooms[room]) {
            rooms[room].buzzList = [];
            io.to(room).emit('buzz-list', []);
        }
    });

    // 退出
    socket.on('leave-room', ({ name, room }) => {
        const roomData = rooms[room];
        if (roomData) {
            roomData.participants = roomData.participants.filter(p => p.name !== name);
            roomData.buzzList = roomData.buzzList.filter(n => n !== name);
            io.to(room).emit('buzz-list', roomData.buzzList);
            socket.leave(room);
        }
    });

    // ルーム解散
    socket.on('end-room', (room) => {
        if (rooms[room]) {
            io.to(room).emit('room-ended');
            delete rooms[room];
        }
    });

    // 切断時の処理（必要であれば）
    socket.on('disconnect', () => {
        console.log('❌ ユーザーが切断しました');
        for (const room in rooms) {
            const roomData = rooms[room];
            
            // 参加者かホストか探す
            const isParticipant = roomData.participants.find(p => p.id === socket.id);
            if (isParticipant) {
                roomData.participants = roomData.participants.filter(p => p.id !== socket.id);
                roomData.buzzList = roomData.buzzList.filter(name => name !== isParticipant.name);
                io.to(room).emit('buzz-list', roomData.buzzList);
            }
    
            if (roomData.hostId === socket.id) {
                // ホストが切断されたら部屋を解散
                io.to(room).emit('room-ended');
                delete rooms[room];
            }
    
            // 参加者もホストもいなくなったら部屋を削除
            if (roomData.participants.length === 0 && !roomData.hostId) {
                delete rooms[room];
            }
        }
    });
});

http.listen(PORT, () => {
    console.log(`🚀 サーバーが起動しました → http://localhost:${PORT}`);
});