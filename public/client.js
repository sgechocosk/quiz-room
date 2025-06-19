const socket = io();

let myName = "";
let myRoom = "";
let isHost = false;

const joinBtn = document.getElementById("joinBtn");
const createRoomBtn = document.getElementById("createRoomBtn");
const buzzBtn = document.getElementById("buzzBtn");
const leaveBtn = document.getElementById("leaveBtn");
const resetBtn = document.getElementById("resetBtn");
const endBtn = document.getElementById("endBtn");

function validateInput(name, room) {
    if (!name || name.length < 1 || name.length > 30) {
        alert("名前は1文字以上30文字以内で入力してください");
        return false;
    }
    if (!room || !/^\d{5}$/.test(room)) {
        alert("ルームIDは5桁の数字で入力してください");
        return false;
    }
    return true;
}

function resetUI() {
    document.getElementById("start-area").style.display = "block";
    document.getElementById("host-area").style.display = "none";
    document.getElementById("participant-area").style.display = "none";
    document.getElementById("nameInput").value = "";
    document.getElementById("roomInput").value = "";
    
    // グローバル変数もリセット
    myName = "";
    myRoom = "";
    isHost = false;
}

function exitRoom(isHost = false) {
    if (isHost) {
        socket.emit("end-room", myRoom);
    } else {
        socket.emit("leave-room", { name: myName, room: myRoom });
    }
    resetUI();
}

function createListItems(list, container) {
    if (!container) return;
    
    container.innerHTML = "";
    const totalSlots = Math.max(list.length, 5);
    
    for (let i = 0; i < totalSlots; i++) {
        const li = document.createElement("li");
        li.textContent = list[i] || "";
        container.appendChild(li);
    }
}

function updateBuzzList(list) {
    createListItems(list, document.getElementById("buzzList_host"));
    createListItems(list, document.getElementById("buzzList"));
}

// 新しく追加：ローディング状態管理
function setLoadingState(element, isLoading) {
    if (isLoading) {
        element.classList.add('loading');
        element.disabled = true;
    } else {
        element.classList.remove('loading');
        element.disabled = false;
    }
}

// ルームに参加ボタン（validateInput使用）
joinBtn.onclick = () => {
    const name = document.getElementById("nameInput").value.trim();
    const room = document.getElementById("roomInput").value.trim();

    // 入力検証を関数化した処理を使用
    if (!validateInput(name, room)) {
        return;
    }

    myName = name;
    myRoom = room;
    isHost = false;

    // ローディング状態を表示
    setLoadingState(joinBtn, true);
    
    socket.emit("check-room", { name, room });
};

// ルームを作成（ローディング状態追加）
createRoomBtn.onclick = () => {
    setLoadingState(createRoomBtn, true);
    tryCreateRoom();
};

// 早押しボタン
buzzBtn.onclick = () => {
    setLoadingState(buzzBtn, false);
    socket.emit("buzz", { name: myName, room: myRoom });
};

// 退出ボタン（exitRoom関数使用）
leaveBtn.onclick = () => {
    exitRoom(false); // isHost = false
};

// リセットボタン
resetBtn.onclick = () => {
    socket.emit("reset", myRoom);
};

// ルーム解散ボタン（exitRoom関数使用）
endBtn.onclick = () => {
    exitRoom(true); // isHost = true
};

function tryCreateRoom() {
    const candidate = Math.floor(10000 + Math.random() * 90000).toString();
    socket.emit("check-room-available", candidate);
}

// リスト更新（統一化した関数を使用）
socket.on("buzz-list", (list) => {
    updateBuzzList(list);
});

// ルーム解散（resetUI関数使用）
socket.on("room-ended", (isInitiator) => {
    if (!isInitiator) {
        alert("ルームが解散されました");
    }
    resetUI();
});

socket.on("host-confirmed", () => {
    isHost = true;
    document.getElementById("host-area").style.display = "block";
    setLoadingState(createRoomBtn, false); // ローディング解除
});

socket.on("room-check-result", (exists) => {
    setLoadingState(joinBtn, false); // ローディング解除
    
    if (!exists) {
        alert("指定されたルームIDは存在しません。");
    } else {
        document.getElementById("start-area").style.display = "none";
        document.getElementById("participant-area").style.display = "block";
        document.getElementById("roomDisplay").textContent = `ルームID: ${myRoom}`;
        document.getElementById("userDisplay").textContent = `あなたの名前: ${myName}`;
    }
});

socket.on("room-available", (roomId) => {
    myRoom = roomId;
    isHost = true;
    socket.emit("create-room", roomId);

    document.getElementById("start-area").style.display = "none";
    document.getElementById("host-area").style.display = "block";
    document.getElementById("hostRoomDisplay").textContent = `ルームID: ${roomId}`;

    // 統一化した関数を使用
    updateBuzzList([]);
});

socket.on("room-unavailable", () => {
    tryCreateRoom();
});

socket.on("name-unavailable", () => {
    setLoadingState(joinBtn, false); // ローディング解除
    alert("名前が重複しています。変更してください。");
});

// エラーハンドリング（resetUI関数使用）
socket.on('connect_error', () => {
    alert('サーバーとの接続に失敗しました。再度お試しください。');
    resetUI();
});

socket.on('room-full', () => {
    setLoadingState(joinBtn, false); // ローディング解除
    alert('ルームが満員です。別のルームをお試しください。');
});

// 新しく追加：接続復旧時の処理
socket.on('connect', () => {
    console.log('サーバーに接続しました');
});

socket.on('disconnect', () => {
    console.log('サーバーとの接続が切断されました');
    alert('サーバーとの接続が切断されました。ページを再読み込みしてください。');
});

// 新しく追加：ページ離脱時の処理
window.addEventListener('beforeunload', () => {
    if (myRoom && myName) {
        exitRoom(isHost);
    }
});
