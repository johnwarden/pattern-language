import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Interpreter } from '../src/runtime.ts';

const root = new URL('./', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8'));
assert.ok(Array.isArray(manifest) && manifest.length, 'The lesson manifest must not be empty.');
const slugs = new Set();
let count = 0;
for (const lesson of manifest) {
  assert.ok(!slugs.has(lesson.slug), `Duplicate lesson slug: ${lesson.slug}`);
  slugs.add(lesson.slug);
  assert.match(lesson.file, /^pages\/[a-z0-9-]+\.md$/, 'Lesson path must stay within pages/.');
  const markdown = readFileSync(new URL(lesson.file, root), 'utf8');
  const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  assert.ok(frontmatter, `${lesson.file}: missing frontmatter`);
  for (const key of ['title', 'slug', 'section', 'summary']) {
    const field = frontmatter[1].match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    assert.ok(field, `${lesson.file}: missing ${key}`);
    const value = field[1].trim().replace(/^"(.*)"$/, '$1');
    assert.equal(value, lesson[key], `${lesson.file}: ${key} differs from manifest`);
  }
  const examples = [...markdown.matchAll(/```pattern\r?\n([\s\S]*?)```/g)].map(match => match[1].replace(/\r?\n$/, ''));
  assert.ok(examples.length, `${lesson.file}: no runnable pattern programs`);
  const expected = Array.isArray(lesson.expectedOutput) ? lesson.expectedOutput : [lesson.expectedOutput];
  assert.equal(examples.length, expected.length, `${lesson.file}: each example needs an authored expectedOutput`);
  examples.forEach((source, index) => {
    const interpreter = new Interpreter();
    const output = interpreter.inspect(interpreter.run(source, 'repl', lesson.file));
    assert.equal(output, expected[index], `${lesson.file}: example ${index + 1}`);
    count++;
  });
  console.log(`PASS ${lesson.slug}`);
}
console.log(`${count} programs in ${manifest.length} lessons passed.`);
