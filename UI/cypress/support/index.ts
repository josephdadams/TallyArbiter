import SocketClient from "socket.io-client";
import SocketMock from "./SocketMock";

declare global {
  interface Window {
    io:any;
  }
}

let realSocket = SocketClient();
let socket = new SocketMock(realSocket);

Cypress.on('window:before:load', (win) => {
  win.io = socket;
});

Cypress.Commands.add('login', (username: string, password: string) => {
  cy.get('#username').clear();
  cy.get('#username').type(username);
  cy.get('#password').clear();
  cy.get('#password').type(password);
  cy.contains("Login").click();
});

Cypress.Commands.add('interceptWebsocket', (event: string, response: any, removeAllListenersAfterExec: boolean = false) => {
  socket.interceptResponse(event, (...args: any) => {
    socket.callEventListeners(event, response);
    if(removeAllListenersAfterExec) socket.removeResponseInterceptors(event);
  });
});
