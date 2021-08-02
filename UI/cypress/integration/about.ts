it('Open about page', () => {
    cy.visit('/#/about');
    cy.contains('MIT License');
    cy.contains('Joseph Adams and contributors.');
    cy.contains('Version');
});