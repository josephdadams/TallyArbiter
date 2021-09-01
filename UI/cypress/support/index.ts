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

Cypress.Commands.add('interceptMessageFromServer', (callback: (type: string, id: string, message: string) => void) => {
  socket.interceptResponse('messaging', (type: string, id: string, message: string) => {
    console.log(type, id, message);
    socket.callEventListeners('messaging', type, id, message);
    callback(type, id, message);
  });
});

Cypress.Commands.add('interceptWebsocket', (event: string, response: any, removeAllListenersAfterExec: boolean = false, passMultipleParams: boolean = false) => {
  socket.interceptResponse(event, (...args: any) => {
    if(passMultipleParams) {
      socket.callEventListeners(event, ...response);
    } else {
      socket.callEventListeners(event, response);
    }
    if(removeAllListenersAfterExec) socket.removeResponseInterceptors(event);
  });
});

Cypress.Commands.add('interceptWebsocketRequest', (event: string, callback: (...args: any) => void, removeWebsocketRequestListenerAfterUse: boolean = false) => {
  console.log(removeWebsocketRequestListenerAfterUse);
  socket.interceptRequest(event, (...args: any) => {
    if(removeWebsocketRequestListenerAfterUse) socket.removeRequestInterceptors(event);
    callback(...args);
  });
});

Cypress.Commands.add('removeWebsocketResponseInterceptors', (event) => {
  socket.removeResponseInterceptors(event);
});

Cypress.Commands.add('removeWebsocketRequestInterceptors', (event) => {
  socket.removeRequestInterceptors(event);
});

Cypress.Commands.add('simulateSocketSentByServer', (event: string, ...args: any) => {
  socket.callEventListeners(event, ...args);
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
      "sources": [
        {
          "sourceId": "TEST",
          "address": "TEST"
        }
      ],
      "active": true
    },
    {
      "deviceId": "0123ab45",
      "busId": "334e4eda",
      "sources": [],
      "linkedSources": [],
      "active": false
    },
    {
      "deviceId": "6789cd01",
      "busId": "e393251c",
      "sources": [],
      "linkedSources": [],
      "active": false
    },
    {
      "deviceId": "6789cd01",
      "busId": "334e4eda",
      "sources": [
        {
          "sourceId": "TEST",
          "address": "TEST"
        }
      ],
      "active": true
    }
  ]);
});

Cypress.Commands.add('simulateListenerClients', () => {
  cy.interceptWebsocket('listener_clients', [
    {
      "id": "testClient#1",
      "socketId": "testSocketId"+Math.random(),
      "deviceId": "0123ab45",
      "listenerType": "web",
      "ipAddress": "::ffff:127.0.0.1",
      "datetime_connected": new Date(),
      "canBeReassigned": true,
      "canBeFlashed": true,
      "inactive": false
    },
    {
      "id": "testClient#2",
      "socketId": "testSocketId"+Math.random(),
      "deviceId": "0123ab45",
      "listenerType": "web",
      "ipAddress": "::ffff:127.0.0.1",
      "datetime_connected": new Date(),
      "canBeReassigned": true,
      "canBeFlashed": true,
      "inactive": false
    },
    {
      "id": "testClient#3",
      "socketId": "testSocketId"+Math.random(),
      "deviceId": "6789cd01",
      "listenerType": "web",
      "ipAddress": "::ffff:127.0.0.1",
      "datetime_connected": new Date(),
      "canBeReassigned": true,
      "canBeFlashed": true,
      "inactive": false
    },
    {
      "id": "testClient#4",
      "socketId": "testSocketId"+Math.random(),
      "deviceId": "6789cd01",
      "listenerType": "web",
      "ipAddress": "::ffff:127.0.0.1",
      "datetime_connected": new Date(),
      "canBeReassigned": true,
      "canBeFlashed": true,
      "inactive": false
    }
  ]);
});

let simulatedInitialData: object = {
  sourceTypes: [],
  sourceTypesDataFields: [],
  sourceTypesBusOptions: [],
  outputTypes: [] = [],
  outputTypesDataFields: [],
  busOptions: [],
  sourcesData: [],
  devicesData: [],
  deviceSources: [],
  deviceActions: [],
  deviceStates: [],
  tslClients: [],
  cloudDestinations: [],
  cloudKeys: [],
  cloudClients: []
}

Cypress.Commands.add('resetSimulatedInitialData', () => {
  simulatedInitialData = {
    sourceTypes: [],
    sourceTypesDataFields: [],
    sourceTypesBusOptions: [],
    outputTypes: [] = [],
    outputTypesDataFields: [],
    busOptions: [],
    sourcesData: [],
    devicesData: [],
    deviceSources: [],
    deviceActions: [],
    deviceStates: [],
    tslClients: [],
    cloudDestinations: [],
    cloudKeys: [],
    cloudClients: []
  }
});

Cypress.Commands.add('setInitialDataValue', (key: string, value: any) => {
  // @ts-ignore
  simulatedInitialData[key] = value;
});

Cypress.Commands.add('simulateInitialData', () => {
  cy.interceptWebsocket('initialdata', Object.values(simulatedInitialData), true, true);
});
