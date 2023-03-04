let APP_ID = "6b97fa2e3e464bd39075bc8f4639c9d7";

let localStream;
let remoteStream;
let peerConnection;

let uid = String(Math.floor(Math.random() * 100));
let token = null;
let client;

let servers = {
  iceServers: [
    {
      urls: [
        "stun.l.google.com:19302",
        "stun1.l.google.com:19302",
        "stun2.l.google.com:19302",
        "stun3.l.google.com:19302",
        "stun4.l.google.com:19302",
        "stun.services.mozilla.com",
        "stun1.voiceeclipse.net",
        "stun2.voiceeclipse.net",
      ],
    },
    {
      urls: "turn:dj-front.doct24.com:3478",
      username: "99c5e73f64647ecb366442fb",
      credential: "EVtW7idU50NbcLcd",
    },
  ],
  iceTransportPolicy: "relay",
  iceCandidatePoolSize: 1,
  rtcpMuxPolicy: "require",
};

// инициализация
let init = async () => {
  // авторизация agora.io
  client = await AgoraRTM.createInstance(APP_ID);
  await client.login({ uid, token });

  // создаем и присоединяемся к каналу
  const channel = client.createChannel("main");
  channel.join();

  channel.on("MemberJoined", handlePeerJoined);
  client.on("MessageFromPeer", handleMessageFromPeer);

  // получаем видео с камеры
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false,
  });

  // переносим поток в тег user-1
  document.getElementById("user-1").srcObject = localStream;
};

// при присоединении нового клиента
let handlePeerJoined = async (MemberId) => {
  console.log("A new peer has joined this room: ", MemberId);
  createOffer(MemberId);
};

let handleMessageFromPeer = async (message, MemberId) => {
  message = JSON.parse(message.text);
  console.log("Message:", message.type);

  if (message.type === "offer") {
    console.log("offer");
    if (!localStream) {
      localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      document.getElementById("user-1").srcObject = localStream;
    }
    document.getElementById("offer-sdp").value = JSON.stringify(message.offer);
    createAnswer(MemberId);
  }
  if (message.type === "answer") {
    document.getElementById("answer-sdp").value = JSON.stringify(
      message.answer
    );
    addAnswer();
  }

  if (message.type === "candidate") {
    if (peerConnection) {
      peerConnection.addIceCandidate(message.candidate);
    }
  }
};

// создаем одноранговое соединение
let createPeerConnection = async (sdpType, MemberId) => {
  // создаем объект соединяющий двух одноранговых узлов
  // также будет хранить информацию SDP и медиа обоих
  peerConnection = new RTCPeerConnection(servers);

  // добавляем удаленный медиа поток
  remoteStream = new MediaStream();
  document.getElementById("user-2").srcObject = remoteStream;

  //добавляем медиа в объект peerConnection
  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  // слушаем удаленное media
  peerConnection.ontrack = async (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  // серия запросов на сервер STUN
  peerConnection.onicecandidate = async (event) => {
    if (event.candidate) {
      // когда создается новый candidate обновляем offer
      document.getElementById(sdpType).value = JSON.stringify(
        peerConnection.localDescription
      );

      client.sendMessageToPeer(
        {
          text: JSON.stringify({
            type: "candidate",
            candidate: event.candidate,
          }),
        },
        MemberId
      );
    }
  };
};

// создаем предложение(sdp)
let createOffer = async (MemberId) => {
  createPeerConnection("offer-sdp", MemberId);

  // создаем offer
  let offer = await peerConnection.createOffer();
  // утсанавливаем локальное описание
  await peerConnection.setLocalDescription(offer);

  // записываем SDP данные в тег textarea
  document.getElementById("offer-sdp").value = JSON.stringify(offer);
  client.sendMessageToPeer(
    {
      text: JSON.stringify({
        type: "offer",
        offer: offer,
      }),
    },
    MemberId
  );
};

// создаем Aswer
let createAnswer = async (MemberId) => {
  createPeerConnection("answer-sdp", MemberId);

  // получаем offer
  let offer = document.getElementById("offer-sdp").value;
  if (!offer) return alert("Retrieve offer from peer first...");

  // Доавляем в peerConnection удаленное описание на основании offer
  offer = JSON.parse(offer);
  await peerConnection.setRemoteDescription(offer);

  // создаем ответ
  let answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  // добавляем ответ в nextarea answer-sdp
  document.getElementById("answer-sdp").value = JSON.stringify(answer);
  client.sendMessageToPeer(
    {
      text: JSON.stringify({
        type: "answer",
        answer: answer,
      }),
    },
    MemberId
  );
};

let addAnswer = async () => {
  let answer = document.getElementById("answer-sdp").value;
  if (!answer) return alert("Retrieve answer from peer first...");

  answer = JSON.parse(answer);

  if (!peerConnection.currentRemoteDescription) {
    peerConnection.setRemoteDescription(answer);
  }
};

init();

document.getElementById("create-offer").addEventListener("click", createOffer);
document
  .getElementById("create-answer")
  .addEventListener("click", createAnswer);
document.getElementById("add-answer").addEventListener("click", addAnswer);
