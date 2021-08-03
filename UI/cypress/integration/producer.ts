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

  describe('Check clients list', () => {
    it('Simulate empty clients list', () => {
      cy.login(Cypress.env("PRODUCER_USERNAME"), Cypress.env("PRODUCER_PASSWORD"));
      //TODO
    });
  });
});
