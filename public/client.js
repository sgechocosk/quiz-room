// グローバル変数
const socket = io();

let myName = "";
let myRoom = "";
let isHost = false;

// DOM要素の取得
const elements = {
    // 入力要素
    nameInput: document.getElementById("nameInput"),
    roomInput: document.getElementById("roomInput"),
    
    // ボタン要素
    joinBtn: document.getElementById("joinBtn"),
    createRoomBtn: document.getElementById("createRoomBtn"),
    buzzBtn: document.getElementById("buzzBtn"),
    leaveBtn: document.getElementById("leaveBtn"),
    resetBtn: document.getElementById("resetBtn"),
    endBtn: document.getElementById("endBtn"),
    
    // エリア要素
    startArea: document.getElementById("start-area"),
    hostArea: document.getElementById("host-area"),
    participantArea: document.getElementById("participant-area"),
    
    // 表示要素
    hostRoomDisplay: document.getElementById("hostRoomDisplay"),
    roomDisplay: document.getElementById("roomDisplay"),
    userDisplay: document.getElementById("userDisplay"),
    buzzListHost: document.getElementById("buzzList_host"),
    buzzListParticipant: document.getElementById("buzzList")
};

// ユーティリティ関数
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

function setLoadingState(element, isLoading) {
    if (!element) return;
    
    if (isLoading) {
        element.classList.add('loading');
        element.disabled = true;
    } else {
        element.classList.remove('loading');
        element.disabled = false;
    }
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
    createListItems(list, elements.buzzListHost);
    createListItems(list, elements.buzzListParticipant);
}

// UI制御関数
function resetGlobalVariables() {
    myName = "";
    myRoom = "";
    isHost = false;
}

function clearInputFields() {
    elements.nameInput.value = "";
    elements.roomInput.value = "";
}

function showArea(areaType) {
    // 全エリアを非表示
    elements.startArea.style.display = "none";
    elements.hostArea.style.display = "none";
    elements.participantArea.style.display = "none";
    
    // 指定されたエリアのみ表示
    switch (areaType) {
        case 'start':
            elements.startArea.style.display = "block";
            break;
        case 'host':
            elements.hostArea.style.display = "block";
            break;
        case 'participant':
            elements.participantArea.style.display = "block";
            break;
    }
}

function resetUI() {
    showArea('start');
    clearInputFields();
    resetGlobalVariables();
}

function showHostArea(roomId) {
    showArea('host');
    elements.hostRoomDisplay.textContent = `ルームID: ${roomId}`;
    updateBuzzList([]);
}

function showParticipantArea() {
    showArea('participant');
    elements.roomDisplay.textContent = `ルームID: ${myRoom}`;
    elements.userDisplay.textContent = `あなたの名前: ${myName}`;
}

// 操作処理関数
function handleJoinRoom() {
    const name = elements.nameInput.value.trim();
    const room = elements.roomInput.value.trim();

    if (!validateInput(name, room)) {
        return;
    }

    myName = name;
    myRoom = room;
    isHost = false;

    setLoadingState(elements.joinBtn, true);
    socket.emit("check-room", { name, room });
}

function handleCreateRoom() {
    setLoadingState(elements.createRoomBtn, true);
    tryCreateRoom();
}

function handleBuzz() {
    setLoadingState(elements.buzzBtn, true);
    socket.emit("buzz", { name: myName, room: myRoom });
    // バズボタンは即座にローディング解除
    setTimeout(() => setLoadingState(elements.buzzBtn, false), 100);
}

function handleLeave() {
    exitRoom(false);
}

function handleReset() {
    socket.emit("reset", myRoom);
}

function handleEndRoom() {
    exitRoom(true);
}

function exitRoom(isHostExit) {
    if (isHostExit) {
        socket.emit("end-room", myRoom);
    } else {
        socket.emit("leave-room", { name: myName, room: myRoom });
    }
    resetUI();
}

function tryCreateRoom() {
    const candidate = Math.floor(10000 + Math.random() * 90000).toString();
    socket.emit("check-room-available", candidate);
}

// イベントリスナーの設定
function setupEventListeners() {
    // ボタンイベント
    elements.joinBtn.onclick = handleJoinRoom;
    elements.createRoomBtn.onclick = handleCreateRoom;
    elements.buzzBtn.onclick = handleBuzz;
    elements.leaveBtn.onclick = handleLeave;
    elements.resetBtn.onclick = handleReset;
    elements.endBtn.onclick = handleEndRoom;
    
    // ページ離脱時の処理
    window.addEventListener('beforeunload', () => {
        if (myRoom && myName) {
            exitRoom(isHost);
        }
    });
}

// Socket.IOイベントハンドラー
function setupSocketListeners() {
    // 接続関連
    socket.on('connect', () => {
        console.log('サーバーに接続しました');
    });

    socket.on('disconnect', () => {
        console.log('サーバーとの接続が切断されました');
        alert('サーバーとの接続が切断されました。ページを再読み込みしてください。');
    });

    socket.on('connect_error', () => {
        alert('サーバーとの接続に失敗しました。再度お試しください。');
        resetUI();
    });

    // ルーム作成関連
    socket.on("room-available", (roomId) => {
        myRoom = roomId;
        isHost = true;
        socket.emit("create-room", roomId);
        showHostArea(roomId);
    });

    socket.on("room-unavailable", () => {
        tryCreateRoom();
    });

    socket.on("host-confirmed", () => {
        isHost = true;
        setLoadingState(elements.createRoomBtn, false);
    });

    // ルーム参加関連
    socket.on("room-check-result", (exists) => {
        setLoadingState(elements.joinBtn, false);
        
        if (!exists) {
            alert("指定されたルームIDは存在しません。");
        } else {
            showParticipantArea();
        }
    });

    socket.on("name-unavailable", () => {
        setLoadingState(elements.joinBtn, false);
        alert("名前が重複しています。変更してください。");
    });

    socket.on('room-full', () => {
        setLoadingState(elements.joinBtn, false);
        alert('ルームが満員です。別のルームをお試しください。');
    });

    // ゲーム関連
    socket.on("buzz-list", (list) => {
        updateBuzzList(list);
    });

    // ルーム終了関連
    socket.on("room-ended", (isInitiator) => {
        if (!isInitiator) {
            alert("ルームが解散されました");
        }
        resetUI();
    });
}

// 初期化
function initialize() {
    setupEventListeners();
    setupSocketListeners();
    console.log('クライアントが初期化されました');
}

// DOMが読み込まれた後に初期化を実行
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}
