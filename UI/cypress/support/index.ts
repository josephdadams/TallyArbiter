import SocketClient from "socket.io-client";
import SocketMock from "./SocketMock";

declare global {
  interface Window {
    io:any;
  }
}

let realSocket = SocketClient();
let socket = new SocketMock(realSocket);

socket.interceptResponse("interfaces", (...args) => {
  socket.callEventListeners("interfaces", [
    {
      "label": "Fake interface #1",
      "name": "fake-interface1",
      "address": "1.2.3.4"
    },
    {
      "label": "Fake interface #2",
      "name": "fake-interface2",
      "address": "5.6.7.8"
    }
  ]);
});

Cypress.on('window:before:load', (win) => {
    win.io = socket;
});