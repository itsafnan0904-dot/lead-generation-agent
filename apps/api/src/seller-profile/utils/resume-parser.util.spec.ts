import { parseResumeText } from './resume-parser.util';

describe('parseResumeText', () => {
  it('extracts inline skills, years of experience, emails and urls', () => {
    const r = parseResumeText(
      'Jane Doe\njane@example.com\nSkills: TypeScript, React; Node.js | PostgreSQL\n' +
        '8+ years of professional experience\nPortfolio https://jane.dev/work',
    );
    expect(r.skills).toEqual(['TypeScript', 'React', 'Node.js', 'PostgreSQL']);
    expect(r.yearsExperience).toBe(8);
    expect(r.emails).toEqual(['jane@example.com']);
    expect(r.urls).toEqual(['https://jane.dev/work']);
  });

  it('reads a skills section until the next heading', () => {
    const r = parseResumeText('Skills\n- Welding\n- CAD, Estimating\n\nExperience\nFoo Corp');
    expect(r.skills).toEqual(['Welding', 'CAD', 'Estimating']);
  });

  it('returns empty results when nothing is present', () => {
    const r = parseResumeText('Just a short note.');
    expect(r).toEqual({ skills: [], yearsExperience: null, emails: [], urls: [] });
  });
});
