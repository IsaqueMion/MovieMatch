import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ageFromBirthdate, todayISO } from '../src/lib/birthdate.ts'

test('birthday unlocks exactly on the calendar date, including leap-day births', () => {
  assert.equal(ageFromBirthdate('2008-10-26','2026-10-25'),17)
  assert.equal(ageFromBirthdate('2008-10-26','2026-10-26'),18)
  assert.equal(ageFromBirthdate('2008-10-26','2026-10-27'),18)
  assert.equal(ageFromBirthdate('2008-02-29','2026-02-28'),17)
  assert.equal(ageFromBirthdate('2008-02-29','2026-03-01'),18)
})
test('invalid, impossible, future and out-of-range dates cannot qualify', () => {
  for (const value of ['', '2000-02-30','2001-02-29','2027-01-01','1899-12-31','2000-1-01','2000-01-01T00:00:00Z']) assert.equal(ageFromBirthdate(value,'2026-10-26'),null,value)
  assert.equal(ageFromBirthdate('2026-10-26','2026-10-26'),0)
})
test('date boundary follows UTC consistently with the database', () => {
  assert.equal(todayISO(new Date('2026-10-25T23:30:00-03:00')),'2026-10-26')
})
