const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const rooms = {};

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('🔌 ユーザーが接続しました');

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

        // 参加者数制限（150人まで）
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
        const roomData = rooms[room];
        if (roomData && roomData.hostId === socket.id) {
            roomData.buzzList = [];
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
        const roomData = rooms[room];
        if (roomData && roomData.hostId === socket.id) {
            // 全員にルーム解散通知（アラート表示させる用）
            socket.to(room).emit('room-ended', false); // false → ホスト以外
            // ホスト本人にも通知（アラート無しでUIだけリセット）
            socket.emit('room-ended', true); // true → ホスト自身

            delete rooms[room];
        }
    });

    // 切断時の処理
    socket.on('disconnect', () => {
        console.log('❌ ユーザーが切断しました');
        
        for (const room in rooms) {
            const roomData = rooms[room];
            
            // ホストが切断された場合
            if (roomData.hostId === socket.id) {
                // 参加者全員にルーム解散通知
                socket.to(room).emit('room-ended', false);
                delete rooms[room];
                continue; // 次のルームへ
            }
            
            // 参加者が切断された場合
            const participantIndex = roomData.participants.findIndex(p => p.id === socket.id);
            if (participantIndex !== -1) {
                const participantName = roomData.participants[participantIndex].name;
                // 参加者リストから削除
                roomData.participants.splice(participantIndex, 1);
                // バズリストからも削除
                roomData.buzzList = roomData.buzzList.filter(name => name !== participantName);
                // 更新されたバズリストを送信
                io.to(room).emit('buzz-list', roomData.buzzList);
            }
        }
    });
});

http.listen(PORT, () => {
    console.log(`🚀 サーバーが起動しました → http://localhost:${PORT}`);
});
