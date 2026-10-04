import { buildHumanFocusUrl, parseHumanFocusParam } from '../humanLink';

describe('humanLink', () => {
  it('builds an encoded focus URL', () => {
    expect(buildHumanFocusUrl('male:skin:UBERON:0002097')).toBe(
      '/human?focus=male%3Askin%3AUBERON%3A0002097'
    );
  });

  it('parses the focus param', () => {
    expect(parseHumanFocusParam('?focus=male%3Askin%3AUBERON%3A0002097')).toBe(
      'male:skin:UBERON:0002097'
    );
    expect(parseHumanFocusParam('')).toBeNull();
    expect(parseHumanFocusParam('?other=1')).toBeNull();
  });
});
