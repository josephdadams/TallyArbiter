describe('Producer page', () => {
  beforeEach(() => {
    cy.visit('/#/producer');
  });

  it('Open producer page', () => {
    cy.location('hash').should('eq', '#/login/producer')
    cy.contains('Please sign in');
  });

  describe('Check if login works', () => {
    it('Login with wrong username', () => {
      cy.login('thisusernamedoesnotexists'+Date.now(), '12345'); //username is totally random
      cy.get('.my-2').should('have.text', 'Wrong username or password!');
    });

    it('Login with wrong password', () => {
      cy.login('admin', 'wrongpassword'+Date.now()); //password is totally random
      cy.get('.my-2').should('have.text', 'Wrong username or password!');
    });

    it('Login', () => {
      cy.login(Cypress.env("PRODUCER_USERNAME"), Cypress.env("PRODUCER_PASSWORD"));
      cy.contains("Devices");
      cy.get('.form-control').should('have.attr', 'placeholder', 'Type a message');
    });
  });

  describe('Check devices list', () => {
    it('Simulate empty devices list', () => {
      cy.interceptWebsocket('listener_clients', []);
      cy.interceptWebsocket('devices', []);
      cy.login(Cypress.env("PRODUCER_USERNAME"), Cypress.env("PRODUCER_PASSWORD"));
      cy.get('.row > :nth-child(1) > :nth-child(2)').should('have.text', 'No devices configured.');
    });

    it('Simulate devices list with two devices', () => {
      cy.interceptWebsocket('listener_clients', []);
      cy.simulateDevices();
      cy.simulateDeviceStates();
      cy.login(Cypress.env("PRODUCER_USERNAME"), Cypress.env("PRODUCER_PASSWORD"));
      cy.get('tbody tr').eq(0)
        .should('contain', 'dev_name#1')
        .and('contain', 'description#1')
        .and('be.visible');
      cy.get('tbody tr').eq(1)
        .should('contain', 'dev_name#2')
        .and('contain', 'description#2')
        .and('be.visible');
    });
    
    it('Simulate devices list with two devices and two listener clients and check if "Flash" works', () => {
      cy.simulateDevices();
      cy.simulateListenerClients();
      cy.simulateDeviceStates();
      cy.interceptWebsocketRequest('flash', (id: string) => {
        expect(id).to.match(/testClient\#([0-9])/g);
      });
      cy.login(Cypress.env("PRODUCER_USERNAME"), Cypress.env("PRODUCER_PASSWORD"));
      cy.get('tbody tr').eq(0)
        .should('contain', 'dev_name#1')
        .and('contain', 'description#1')
        .and('contain', '2')
        .and('be.visible');
      cy.get('tbody tr').eq(1)
        .should('contain', 'dev_name#2')
        .and('contain', 'description#2')
        .and('contain', '2')
        .and('be.visible');
      
      cy.get('tbody tr').eq(2)
        .should('contain', '127.0.0.1')
        .and('contain', 'web')
        .and('contain', 'dev_name#1')
        .and('be.visible');
      cy.get('tbody tr').eq(3)
        .should('contain', '127.0.0.1')
        .and('contain', 'web')
        .and('contain', 'dev_name#1')
        .and('be.visible');
      cy.get('tbody tr').eq(4)
        .should('contain', '127.0.0.1')
        .and('contain', 'web')
        .and('contain', 'dev_name#2')
        .and('be.visible');
      cy.get('tbody tr').eq(5)
        .should('contain', '127.0.0.1')
        .and('contain', 'web')
        .and('contain', 'dev_name#2')
        .and('be.visible');
      
      cy.get(':nth-child(1) > :nth-child(6) > .btn').click();
      cy.get(':nth-child(2) > :nth-child(6) > .btn').click();
      cy.get(':nth-child(3) > :nth-child(6) > .btn').click();
      cy.get(':nth-child(4) > :nth-child(6) > .btn').click();
    });

    it("Try to use chat", () => {
      cy.simulateDevices();
      cy.simulateListenerClients();
      cy.simulateDeviceStates();
      cy.interceptMessageFromServer((type: string, id: string, message: string) => {
        expect(message).to.equal('message test 12345');
      });
      cy.login(Cypress.env("PRODUCER_USERNAME"), Cypress.env("PRODUCER_PASSWORD"));
      cy.get('.form-control').clear();
      cy.get('.form-control').type('message test 12345');
      cy.get('.fas').click();
    });
  });
});
