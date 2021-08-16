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
      cy.interceptWebsocket('devices', []);
      cy.login(Cypress.env("PRODUCER_USERNAME"), Cypress.env("PRODUCER_PASSWORD"));
      cy.get('.row > :nth-child(1) > :nth-child(2)').should('have.text', 'No devices configured.');
    });

    it('Simulate devices list with two devices', () => {
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
      cy.login(Cypress.env("PRODUCER_USERNAME"), Cypress.env("PRODUCER_PASSWORD"));
      cy.get('table').contains('td', 'dev_name#1').should('be.visible');
      cy.get('table').contains('td', 'description#1').should('be.visible');
      cy.get('table').contains('td', 'dev_name#2').should('be.visible');
      cy.get('table').contains('td', 'description#2').should('be.visible');
    });
  });
});
