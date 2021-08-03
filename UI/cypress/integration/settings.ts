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
      cy.login(Cypress.env("PRODUCER_USERNAME"), Cypress.env("PRODUCER_PASSWORD"));
      cy.get('.container > :nth-child(1) > h2').should('be.visible');
      cy.contains("Sources");
    });
  });
});
