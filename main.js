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
      urls: "stun:relay.metered.ca:80",
    },
    {
      urls: "turn:relay.metered.ca:80",
      username: "7f90a72f842ec75ff052f05a",
      credential: "Oli2NaWtjA2HVKsw",
    },
    {
      urls: "turn:relay.metered.ca:443",
      username: "7f90a72f842ec75ff052f05a",
      credential: "Oli2NaWtjA2HVKsw",
    },
    {
      urls: "turn:relay.metered.ca:443?transport=tcp",
      username: "7f90a72f842ec75ff052f05a",
      credential: "Oli2NaWtjA2HVKsw",
    },
  ],
  // iceCandidatePoolSize: 10,
  // iceConnectionReceivingTimeout: 7000,
  // iceConnectionRetryCount: 5,
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
    console.log(remoteStream);
    if (peerConnection) {
      peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
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
      console.log(event.candidate.candidate);
      // когда создается новый candidate обновляем offer
      document.getElementById(sdpType).value = JSON.stringify(
        peerConnection.localDescription
      );
      if (event.candidate.type == "srflx") {
        console.log("The STUN server is reachable!");
        console.log(`   Your Public IP Address is: ${event.candidate.address}`);
      }

      if (event.candidate.type == "relay") {
        console.log("The TURN server is reachable !");
      }

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
  await peerConnection.setLocalDescription(new RTCSessionDescription(offer));

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
  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

  // создаем ответ
  let answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(new RTCSessionDescription(answer));

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
    peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }
};

init();

// document.getElementById("create-offer").addEventListener("click", createOffer);
// document
//   .getElementById("create-answer")
//   .addEventListener("click", createAnswer);
// document.getElementById("add-answer").addEventListener("click", addAnswer);
