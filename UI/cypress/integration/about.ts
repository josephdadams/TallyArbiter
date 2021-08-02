describe('About page', () => {
  it('Open about page and check text', () => {
    cy.visit('/#/about');
    cy.contains('MIT License');
    cy.contains('Joseph Adams and contributors.');
    cy.contains('Version');
  });
});
