describe('Settings page', () => {
  beforeEach(() => {
    cy.visit('/#/settings');
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
});
