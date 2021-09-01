describe('Settings page', () => {
  beforeEach(() => {
    cy.visit('/#/settings');
    cy.resetSimulatedInitialData();
    cy.removeWebsocketRequestInterceptors('manage'); //for extra security
  });

  it('Open settings page', () => {
    cy.location('hash').should('eq', '#/login/settings')
    cy.contains('Please sign in');
  });

  describe('Check if login works', () => {
    it('Login with wrong username', () => {
      cy.login('thisusernamedoesnotexists'+Date.now(), '12345'); //username is totally random
      cy.get('.my-2').should('have.text', 'Wrong username or password!');
    });

    it('Login with wrong password', () => {
      cy.get('#username').clear();
      cy.get('#username').type('admin');
      cy.get('#password').clear();
      cy.login('admin', 'wrongpassword'+Date.now()); //password is totally random
      cy.contains("Login").click();
      cy.get('.my-2').should('have.text', 'Wrong username or password!');
    });

    it('Login', () => {
      cy.login(Cypress.env("SETTINGS_USERNAME"), Cypress.env("SETTINGS_PASSWORD"));
      cy.contains('Devices');
    });
  });

  describe('Check if "TSL Clients" section works', ()  => {
    it('Check if it reads existing switch status', () => {
      cy.interceptWebsocket("tslclients_1secupdate", true);
      cy.simulateInitialData();
      cy.login(Cypress.env("SETTINGS_USERNAME"), Cypress.env("SETTINGS_PASSWORD"));
      cy.get('#chkTSLClients_1SecUpdate').should('be.checked');
    });

    it('Check if TSL Clients list has loaded correctly', () => {
      cy.setInitialDataValue("tslClients", [
        {
          "id": "14122439",
          "ip": "192.168.1.1",
          "port": 1234,
          "transport": "tcp",
          "connected": true,
          "socket": {},
          "error": false
        },
        {
          "id": "14122440",
          "ip": "192.168.1.2",
          "port": 5678,
          "transport": "udp",
          "connected": true,
          "socket": {},
          "error": false
        }
      ])
      cy.simulateInitialData();
      cy.login(Cypress.env("SETTINGS_USERNAME"), Cypress.env("SETTINGS_PASSWORD"));
      cy.get('tbody tr').eq(0)
        .should('contain', '192.168.1.1')
        .and('contain', '1234')
        .and('contain', 'tcp')
        .and('be.visible');
      cy.get('tbody tr').eq(1)
        .should('contain', '192.168.1.2')
        .and('contain', '5678')
        .and('contain', 'udp')
        .and('be.visible');
    });

  });

  describe('Check if "Cloud Settings" section works', ()  => {
    //Destinations list
    it('Add new destination', () => {
      
      cy.interceptWebsocketRequest('manage', (params: any) => {
        expect(params.cloudDestination.host).to.equal("192.168.1.1");
        expect(params.cloudDestination.port).to.equal(1234);
        expect(params.cloudDestination.key).to.equal("key");
        cy.simulateSocketSentByServer("manage_response", {
          "result": "cloud-destination-added-successfully"
        });
      }, true);
      
      cy.setInitialDataValue("cloudDestinations", []);
      cy.simulateInitialData();
      cy.login(Cypress.env("SETTINGS_USERNAME"), Cypress.env("SETTINGS_PASSWORD"));
      cy.contains('No cloud destinations configured.');
      cy.get(':nth-child(2) > h4 > .btn').click({ force: true });
      cy.get('#cloudHost').type('192.168.1.1');
      cy.get('#cloudPort').type('1234');
      cy.get('#cloudKey').type('key');
      cy.get('.d-flex > .btn').click();
    });
    it('Destinations list with two destinations', () => {
      cy.interceptWebsocketRequest('manage', (params: any) => {
        expect(params.cloudDestination.key).to.match(/(first|second)_key_new/g);
        cy.simulateSocketSentByServer("manage_response", {
          "result": "cloud-destination-edited-successfully"
        });
      });
      cy.setInitialDataValue("cloudDestinations", [
        {
          "host": "192.168.1.1",
          "port": 1122,
          "key": "first_key",
          "id": "08f4first",
          "status": "connected"
        },
        {
          "host": "192.168.1.2",
          "port": 3344,
          "key": "second_key",
          "id": "08second",
          "status": "connected"
        }
      ]);
      cy.simulateInitialData();
      cy.login(Cypress.env("SETTINGS_USERNAME"), Cypress.env("SETTINGS_PASSWORD"));
      cy.get('tbody tr').eq(0)
        .should('contain', '192.168.1.1')
        .and('contain', '1122')
        .and('be.visible');
      cy.get('tbody > :nth-child(1) > :nth-child(5) > :nth-child(1)').click({ force: true });
      cy.wait(200);
      cy.get('#cloudKey').type('_new');
      cy.get('.d-flex > .btn').click();
      cy.get('tbody tr').eq(1)
        .should('contain', '192.168.1.2')
        .and('contain', '3344')
        .and('be.visible');
      cy.get('tbody > :nth-child(2) > :nth-child(5) > :nth-child(1)').click({ force: true });
      cy.wait(200);
      cy.get('#cloudKey').type('_new');
      cy.get('.d-flex > .btn').click();
    });

    //Keys list
    it('Add new key', () => {
      cy.interceptWebsocketRequest('manage', (params: any) => {
        expect(params.key).to.equal("key");
        cy.simulateSocketSentByServer("manage_response", {
          "result": "cloud-key-added-successfully"
        });
      }, true);
      cy.setInitialDataValue("cloudKeys", []);
      cy.simulateInitialData();
      cy.login(Cypress.env("SETTINGS_USERNAME"), Cypress.env("SETTINGS_PASSWORD"));
      cy.contains('No cloud keys configured.');
      cy.get(':nth-child(3) > h4 > .btn').click({ force: true });
      cy.get('#key').type('key');
      cy.get('.d-flex > .btn').click();
    });
    it('Keys list with two keys', () => {
      cy.interceptWebsocketRequest('manage', (params: any) => {
        expect(params.key).to.match(/key(1|2)/g);
        cy.simulateSocketSentByServer("manage_response", {
          "result": "cloud-destination-deleted-successfully"
        });
      });
      cy.setInitialDataValue("cloudKeys", ["key1", "key2"]);
      cy.simulateInitialData();
      cy.login(Cypress.env("SETTINGS_USERNAME"), Cypress.env("SETTINGS_PASSWORD"));
      cy.get('tbody tr').eq(0)
        .should('contain', 'key1')
        .and('be.visible');
      cy.get('tbody > :nth-child(1) > :nth-child(2) > .btn').click({ force: true });
      cy.get('.swal2-confirm').click();
      cy.get('tbody tr').eq(1)
        .should('contain', 'key2')
        .and('be.visible');
      cy.get('tbody > :nth-child(2) > :nth-child(2) > .btn').click({ force: true });
      cy.get('.swal2-confirm').click();
    });

    //Clients list
    it('Empty clients list', () => {
      cy.setInitialDataValue("cloudClients", []);
      cy.simulateInitialData();
      cy.login(Cypress.env("SETTINGS_USERNAME"), Cypress.env("SETTINGS_PASSWORD"));
      cy.contains('No cloud clients connected.');
    });
    it('Clients list with two clients', () => {
      cy.interceptWebsocketRequest('manage', (params: any) => {
        expect(params.id).to.match(/client(1|2)/g);
        cy.simulateSocketSentByServer("manage_response", {
          "result": "cloud-destination-deleted-successfully"
        });
      });
      cy.setInitialDataValue("cloudClients", [
        {
          "id": "client1",
          "socketId": "_h-tbogHWXYlt0kmABCD",
          "key": "key1",
          "ipAddress": "192.168.1.1",
          "datetimeConnected": 1630351508761,
          "inactive": false
        },
        {
          "id": "client2",
          "socketId": "_h-tbogHWXYlt0kmEFGH",
          "key": "key2",
          "ipAddress": "192.168.1.2",
          "datetimeConnected": 1630351508761,
          "inactive": false
        }
      ]);
      cy.simulateInitialData();
      cy.login(Cypress.env("SETTINGS_USERNAME"), Cypress.env("SETTINGS_PASSWORD"));
      cy.get('tbody tr').eq(0)
        .should('contain', '192.168.1.1')
        .and('contain', 'key1')
        .and('be.visible');
      cy.get('tbody > :nth-child(1) > :nth-child(3) > .btn').click({ force: true });
      cy.get('tbody tr').eq(1)
        .should('contain', '192.168.1.2')
        .and('contain', 'key2')
        .and('be.visible');
      cy.get('tbody > :nth-child(2) > :nth-child(3) > .btn').click({ force: true });
    });
  });

  describe('Check if "Logs" section works', ()  => {
    it.only('Simulate logs of all types', () => {
      cy.interceptWebsocket('logs', [
        {
          "datetime": "2021-09-01T10:24:40.389Z",
          "log": "info-quiet example #1",
          "type": "info-quiet"
        },
        {
          "datetime": "2021-09-01T10:24:40.389Z",
          "log": "info-quiet example #2",
          "type": "info-quiet"
        },
        {
          "datetime": "2021-09-01T10:24:40.389Z",
          "log": "info example #1",
          "type": "info"
        },
        {
          "datetime": "2021-09-01T10:24:40.389Z",
          "log": "info example #2",
          "type": "info"
        },
        {
          "datetime": "2021-09-01T10:24:40.389Z",
          "log": "console-action example #1",
          "type": "console-action"
        },
        {
          "datetime": "2021-09-01T10:24:40.389Z",
          "log": "console-action example #2",
          "type": "console-action"
        },
        {
          "datetime": "2021-09-01T10:24:40.389Z",
          "log": "error example #1",
          "type": "error"
        },
        {
          "datetime": "2021-09-01T10:24:40.389Z",
          "log": "error example #2",
          "type": "error"
        }
      ]);
      cy.login(Cypress.env("SETTINGS_USERNAME"), Cypress.env("SETTINGS_PASSWORD"));

      //Check info (default selection)
      cy.get('.form-select').should('have.value', 'info');
      cy.get('.logs > :nth-child(1)').should('have.text', '[9/1/21 12:24 PM] info example #1');
      cy.get('.logs > :nth-child(2)').should('have.text', '[9/1/21 12:24 PM] info example #2');
      cy.get('.logs > :nth-child(3)').should('have.text', '[9/1/21 12:24 PM] console-action example #1');
      cy.get('.logs > :nth-child(4)').should('have.text', '[9/1/21 12:24 PM] console-action example #2');
      cy.get('.logs > :nth-child(5)').should('have.text', '[9/1/21 12:24 PM] error example #1');
      cy.get('.logs > :nth-child(6)').should('have.text', '[9/1/21 12:24 PM] error example #2');

      //Check info-quiet
      cy.get('.form-select').select('info-quiet');
      cy.get('.logs > :nth-child(1)').should('have.text', '[9/1/21 12:24 PM] info-quiet example #1');
      cy.get('.logs > :nth-child(2)').should('have.text', '[9/1/21 12:24 PM] info-quiet example #2');
      cy.get('.logs > :nth-child(3)').should('have.text', '[9/1/21 12:24 PM] info example #1');
      cy.get('.logs > :nth-child(4)').should('have.text', '[9/1/21 12:24 PM] info example #2');
      cy.get('.logs > :nth-child(5)').should('have.text', '[9/1/21 12:24 PM] console-action example #1');
      cy.get('.logs > :nth-child(6)').should('have.text', '[9/1/21 12:24 PM] console-action example #2');
      cy.get('.logs > :nth-child(7)').should('have.text', '[9/1/21 12:24 PM] error example #1');
      cy.get('.logs > :nth-child(8)').should('have.text', '[9/1/21 12:24 PM] error example #2');

      //Check console-action
      cy.get('.form-select').select('console-action');
      cy.get('.logs > :nth-child(1)').should('have.text', '[9/1/21 12:24 PM] console-action example #1');
      cy.get('.logs > :nth-child(2)').should('have.text', '[9/1/21 12:24 PM] console-action example #2');
      cy.get('.logs > :nth-child(3)').should('have.text', '[9/1/21 12:24 PM] error example #1');
      cy.get('.logs > :nth-child(4)').should('have.text', '[9/1/21 12:24 PM] error example #2');

      //Check error
      cy.get('.form-select').select('error');
      cy.get('.logs > :nth-child(1)').should('have.text', '[9/1/21 12:24 PM] error example #1');
      cy.get('.logs > :nth-child(2)').should('have.text', '[9/1/21 12:24 PM] error example #2');

      //Check if sending a new log works
      cy.get('.form-select').select('info');
      cy.simulateSocketSentByServer("log_item", {
        "datetime": "2021-09-01T10:24:40.389Z",
        "log": "info example #3",
        "type": "info"
      });
      cy.get('.logs > :nth-child(7)').should('have.text', '[9/1/21 12:24 PM] info example #3');
    });
  });
});
