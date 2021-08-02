describe('Settings page', () => {
  it('Open settings page', () => {
    cy.visit('/#/settings');
    cy.location('hash').should('eq', '#/login/settings')
    cy.contains('Please sign in');
  });

  describe('Check if login works', () => {
    it('Login with wrong username', () => {
      cy.get('#username').clear();
      cy.get('#username').type('thisusernamedoesnotexists'+Date.now()); //username is totally random
      cy.get('#password').clear();
      cy.get('#password').type('12345');
      cy.contains("Login").click();
      cy.get('.my-2').should('have.text', 'Wrong username or password!');
    });

    it('Login with wrong password', () => {
        cy.get('#username').clear();
        cy.get('#username').type('admin');
        cy.get('#password').clear();
        cy.get('#password').type('wrongpassword'+Date.now()); //password is totally random
        cy.contains("Login").click();
        cy.get('.my-2').should('have.text', 'Wrong username or password!');
    });

    it('Login', () => {
      cy.get('#username').clear();
      cy.get('#username').type(Cypress.env("SETTINGS_USERNAME"));
      cy.get('#password').clear();
      cy.get('#password').type(Cypress.env("SETTINGS_PASSWORD"));
      cy.contains("Login").click();
      cy.get('.container > :nth-child(1) > h2').should('be.visible');
      cy.contains("Sources");
    });
  });
});
