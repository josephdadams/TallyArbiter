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

Cypress.Commands.add('simulateDevices', () => {
  cy.interceptWebsocket('devices', [
    {
      "name": "dev_name#1",
      "description": "description#1",
      "enabled": true,
      "id": "0123ab45"
    },
    {
      "name": "dev_name#2",
      "description": "description#2",
      "enabled": true,
      "id": "6789cd01"
    }
  ]);
});

Cypress.Commands.add('simulateBusOptions', () => {
  cy.interceptWebsocket('bus_options', [
    {
      "id": "e393251c",
      "label": "Preview",
      "type": "preview"
    },
    {
      "id": "334e4eda",
      "label": "Program",
      "type": "program"
    }
  ]);
});

Cypress.Commands.add('simulateDeviceStates', () => {
  cy.simulateBusOptions();
  cy.interceptWebsocket('device_states', [
    {
      "deviceId": "0123ab45",
      "busId": "e393251c",
      "sources": [],
      "linkedSources": [],
      "active": false
    },
    {
      "deviceId": "0123ab45",
      "busId": "334e4eda",
      "sources": [
        {
          "sourceId": "TEST",
          "address": "TEST"
        }
      ],
      "active": true
    },
    {
      "deviceId": "6789cd01",
      "busId": "e393251c",
      "sources": [
        {
          "sourceId": "TEST",
          "address": "TEST"
        }
      ],
      "active": true
    },
    {
      "deviceId": "6789cd01",
      "busId": "334e4eda",
      "sources": [],
      "linkedSources": [],
      "active": false
    }
  ]);
});
