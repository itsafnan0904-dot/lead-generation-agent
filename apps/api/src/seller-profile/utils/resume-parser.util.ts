export interface ParsedResume {
  skills: string[];
  yearsExperience: number | null;
  emails: string[];
  urls: string[];
}

const SKILL_HEADING = /^\s*(technical\s+skills|core\s+skills|key\s+skills|skills|technologies|tech\s+stack|expertise)\s*[:\-]?\s*$/i;
const NEXT_HEADING = /^\s*(experience|work\s+experience|employment|education|projects|certifications?|summary|profile|languages|interests|references)\s*[:\-]?\s*$/i;

/**
 * Deterministic, dependency-free resume extraction. Intentionally conservative:
 * it only reports what is explicitly present in the text.
 */
export function parseResumeText(text: string): ParsedResume {
  const lines = text.split(/\r?\n/);
  const skills = new Set<string>();

  let inSkills = false;
  for (const raw of lines) {
    const line = raw.trim();
    const inline = line.match(/^(technical\s+skills|core\s+skills|key\s+skills|skills|technologies|tech\s+stack|expertise)\s*[:\-]\s*(.+)$/i);
    if (inline) {
      addSkills(skills, inline[2]);
      inSkills = false;
      continue;
    }
    if (SKILL_HEADING.test(line)) {
      inSkills = true;
      continue;
    }
    if (inSkills) {
      if (!line || NEXT_HEADING.test(line)) {
        if (NEXT_HEADING.test(line) || skills.size > 0) inSkills = false;
        continue;
      }
      addSkills(skills, line.replace(/^[-*•·]\s*/, ''));
    }
  }

  let yearsExperience: number | null = null;
  const yearsMatches = [...text.matchAll(/(\d{1,2})\+?\s*(?:years|yrs)\b[^.\n]{0,40}\bexperience/gi)];
  if (yearsMatches.length) {
    yearsExperience = Math.max(...yearsMatches.map((m) => parseInt(m[1], 10)));
  }

  const emails = [...new Set(text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? [])];
  const urls = [...new Set(text.match(/https?:\/\/[^\s)>\]]+/g) ?? [])];

  return { skills: [...skills].slice(0, 50), yearsExperience, emails, urls };
}

function addSkills(target: Set<string>, chunk: string): void {
  for (const part of chunk.split(/[,;|•·]/)) {
    const skill = part.trim().replace(/\.$/, '');
    if (skill.length >= 2 && skill.length <= 40) target.add(skill);
  }
}
