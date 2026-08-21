import { appliedTweakCatalog, debloatCatalog, tweakCatalog } from './support/fixtures';

/**
 * The action bar has to reach the edges of the content panel.
 *
 * Two things conspired against that and neither is visible from the markup: the scroll container's
 * own bottom padding always shows beneath a `sticky bottom-0` element, because sticky pins to the
 * scrollport rather than to the border box; and sticky never pushes anything downwards, so on a
 * catalog shorter than the window the bar simply sat wherever the content happened to end.
 */
describe('action bar sits flush with the content panel', () => {
  const assertFlush = (testId = 'tweak-action-bar') =>
    cy.getByCy('app-main').then(($main) => {
      cy.getByCy(testId).then(($bar) => {
        const main = $main[0];
        const bar = $bar[0].getBoundingClientRect();

        expect(
          Math.round(main.getBoundingClientRect().bottom - bar.bottom),
          'strip of padding below the bar'
        ).to.equal(0);
        // clientWidth excludes the scrollbar, which the bar correctly stops short of.
        expect(Math.round(bar.width), 'bar spans the content panel').to.equal(main.clientWidth);
      });
    });

  beforeEach(() => {
    cy.visitApp();
    cy.getByCy('nav-Optimize').click();
  });

  it('reaches the bottom when the catalog is shorter than the window', () => {
    cy.emitHost('tweaksLoaded', { ...tweakCatalog, tweaks: [] });

    assertFlush();
  });

  it('stays at the bottom with a catalog that scrolls', () => {
    cy.emitHost('tweaksLoaded', appliedTweakCatalog);
    cy.getByCy('app-main').scrollTo('bottom');

    assertFlush();
  });

  // Debloat has an action bar of its own, and a bar is only ever wrong in the browser: neither
  // failure this guard exists for is visible in the markup, so the second one has to be measured
  // too rather than assumed to inherit the first one's fix.
  describe('on the Debloat screen', () => {
    beforeEach(() => {
      cy.getByCy('nav-Debloat').click();
    });

    it('reaches the bottom when the list is shorter than the window', () => {
      cy.emitHost('debloatLoaded', { packages: [] });

      assertFlush('debloat-action-bar');
    });

    it('stays at the bottom with a list that scrolls', () => {
      cy.emitHost('debloatLoaded', debloatCatalog);
      cy.getByCy('app-main').scrollTo('bottom');

      assertFlush('debloat-action-bar');
    });
  });
});
