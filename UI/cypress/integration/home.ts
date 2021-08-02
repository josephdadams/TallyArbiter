describe('Home page', () => {
  it('Open home page', () => {
    cy.visit('/');
    cy.contains('Welcome to Tally Arbiter');
  });

  describe('Check if QR code and interfaces list work', () => {
    it('Check if interfaces list works', () => {
      cy.get('.row-cols-1 > :nth-child(2)').click();
      cy.get('.rounded > ul > :nth-child(1) > a').should('have.attr', 'href', 'http://1.2.3.4:4455/#/tally');
      cy.get('.rounded > ul > :nth-child(2) > a').should('have.attr', 'href', 'http://5.6.7.8:4455/#/tally');
    });
    it('Try selecting other interfaces', () => {
      cy.get('.row-cols-1 > :nth-child(2)').click();
      cy.get('.form-select').select('1: http://1.2.3.4:4455/#/tally');
      cy.get('canvas').should('have.attr', 'ng-reflect-value', 'http://1.2.3.4:4455/#/tally');
      cy.get('.form-select').select('2: http://5.6.7.8:4455/#/tally');
      cy.get('canvas').should('have.attr', 'ng-reflect-value', 'http://5.6.7.8:4455/#/tally');
    });
  });
});
