import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const source = ts.transpileModule(readFileSync(new URL('../src/lib/account.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText
const profile = { id: 'profile-id', avatar_path: 'profile-id/old.webp', cover_path: null }
const file = { type: 'image/jpeg', size: 1024 }

function fixture({ legacy = false, type = 'image/webp', size = 1024, width = 1024, height = 512, decodeError = false, convertError = false, uploadError = null, updateError = null } = {}) {
  const uploaded = [], removed = [], revoked = [], updates = []
  let closed = 0, randomCalls = 0, drawn = 0
  const blob = new Blob([new Uint8Array(size)], { type })
  const bitmap = { width, height, close: () => closed++ }
  const canvas = {
    width: 0, height: 0,
    getContext: () => ({ drawImage: () => drawn++ }),
    toBlob: (callback, requestedType) => {
      assert.equal(requestedType, 'image/webp')
      callback(convertError ? null : blob)
    },
  }
  const storage = {
    upload: async (path, body, options) => { uploaded.push({ path, body, options }); return { error: uploadError } },
    remove: async paths => { removed.push(...paths); return { error: null } },
  }
  const supabase = {
    storage: { from: bucket => { assert.equal(bucket, 'profile-media'); return storage } },
    from: table => {
      assert.equal(table, 'profiles')
      return { update: values => {
        updates.push(values)
        return { eq: (field, value) => {
          assert.equal(field, 'id'); assert.equal(value, profile.id)
          return { select: () => ({ single: async () => ({ data: { ...profile, ...values }, error: updateError }) }) }
        } }
      } }
    },
  }
  const exports = {}
  runInNewContext(source, {
    exports,
    require: module => { assert.equal(module, './supabase'); return { supabase } },
    createImageBitmap: legacy ? undefined : async () => {
      if (decodeError) throw new Error('decode failed')
      return bitmap
    },
    Image: class {
      width = width
      height = height
      set src(value) {
        assert.equal(value, 'blob:fixture')
        queueMicrotask(() => decodeError ? this.onerror() : this.onload())
      }
    },
    URL: { createObjectURL: () => 'blob:fixture', revokeObjectURL: url => revoked.push(url) },
    document: { createElement: tag => { assert.equal(tag, 'canvas'); return canvas } },
    crypto: {
      randomUUID: legacy ? undefined : () => '11111111-1111-4111-8111-111111111111',
      getRandomValues: bytes => { randomCalls++; bytes.fill(17); return bytes },
    },
  })
  return { upload: exports.uploadProfileImage, uploaded, removed, revoked, updates, canvas, closed: () => closed, randomCalls: () => randomCalls, drawn: () => drawn }
}

test('WebP upload keeps its format, resizes avatar and removes old media after profile update', async () => {
  const f = fixture()
  const result = await f.upload(profile, 'avatar', file)
  assert.equal(f.uploaded[0].path, 'profile-id/avatar-11111111-1111-4111-8111-111111111111.webp')
  assert.equal(f.uploaded[0].options.contentType, 'image/webp')
  assert.equal(f.canvas.width, 512); assert.equal(f.canvas.height, 256)
  assert.equal(result.avatar_path, f.uploaded[0].path)
  assert.deepEqual(f.removed, [profile.avatar_path])
  assert.equal(f.closed(), 1)
})

test('PNG encoder fallback uploads matching PNG extension and MIME', async () => {
  const f = fixture({ type: 'image/png' })
  const result = await f.upload(profile, 'cover', file)
  assert.match(f.uploaded[0].path, /\/cover-.*\.png$/)
  assert.equal(f.uploaded[0].body.type, 'image/png')
  assert.equal(f.uploaded[0].options.contentType, 'image/png')
  assert.equal(result.cover_path, f.uploaded[0].path)
  assert.equal(f.canvas.width, 1024); assert.equal(f.canvas.height, 512)
  assert.deepEqual(f.removed, [])
})

test('missing image bitmap and UUID APIs use Image and cryptographic bytes, then revoke object URL', async () => {
  const f = fixture({ legacy: true, type: 'image/png' })
  await f.upload(profile, 'avatar', file)
  assert.equal(f.uploaded[0].path, `profile-id/avatar-${'11'.repeat(16)}.png`)
  assert.equal(f.randomCalls(), 1)
  assert.equal(f.closed(), 0)
  assert.deepEqual(f.revoked, ['blob:fixture'])
})

test('failed legacy image decode revokes its object URL and preserves existing photo', async () => {
  const f = fixture({ legacy: true, decodeError: true })
  await assert.rejects(f.upload(profile, 'avatar', file), /abrir a imagem/)
  assert.deepEqual(f.revoked, ['blob:fixture'])
  assert.equal(f.uploaded.length, 0); assert.deepEqual(f.removed, [])
})

test('validation rejects invalid file MIME and input size before uploading', async () => {
  const f = fixture()
  await assert.rejects(f.upload(profile, 'avatar', { ...file, type: 'image/svg+xml' }), /Use JPG, PNG ou WebP/)
  await assert.rejects(f.upload(profile, 'avatar', { ...file, size: 6 * 1024 * 1024 + 1 }), /Use JPG, PNG ou WebP/)
  assert.equal(f.drawn(), 0); assert.equal(f.uploaded.length, 0)
})

test('megapixel limit rejects the image before drawing and releases bitmap', async () => {
  const f = fixture({ width: 10000, height: 5000 })
  await assert.rejects(f.upload(profile, 'avatar', file), /40 megapixels/)
  assert.equal(f.drawn(), 0); assert.equal(f.uploaded.length, 0); assert.equal(f.closed(), 1)
})

test('oversized PNG and unexpected encoder formats are rejected before any storage write', async () => {
  for (const options of [{ type: 'image/png', size: 2 * 1024 * 1024 + 1 }, { type: 'image/gif' }]) {
    const f = fixture(options)
    await assert.rejects(f.upload(profile, 'avatar', file), /2 MB|converter a imagem/)
    assert.equal(f.uploaded.length, 0); assert.deepEqual(f.removed, []); assert.equal(f.closed(), 1)
  }
})

test('null canvas output and storage failure preserve the old photo and close bitmap', async () => {
  for (const options of [{ convertError: true }, { uploadError: new Error('storage failed') }]) {
    const f = fixture(options)
    await assert.rejects(f.upload(profile, 'avatar', file), /converter a imagem|storage failed/)
    assert.equal(f.updates.length, 0); assert.deepEqual(f.removed, []); assert.equal(f.closed(), 1)
  }
})

test('profile update failure removes only the newly uploaded PNG and preserves the old photo', async () => {
  const f = fixture({ type: 'image/png', updateError: new Error('profile update failed') })
  await assert.rejects(f.upload(profile, 'avatar', file), /profile update failed/)
  assert.deepEqual(f.removed, [f.uploaded[0].path])
  assert.notEqual(f.removed[0], profile.avatar_path)
  assert.equal(f.closed(), 1)
})

test('migration path rules accept both output formats and reject wrong owners, kinds and paths', () => {
  const migration = readFileSync(new URL('../supabase/migrations/20261026101157_profile_image_formats.sql', import.meta.url), 'utf8')
  const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  const checks = [...migration.matchAll(/(avatar_path|cover_path) ~ \('\^' \|\| id::text \|\| '([^']+)'\)/g)]
  assert.equal(checks.length, 2)
  for (const [, field, suffix] of checks) {
    const pattern = new RegExp(`^${owner}${suffix}`)
    const kind = field === 'avatar_path' ? 'avatar' : 'cover'
    for (const extension of ['webp', 'png']) {
      assert.ok(pattern.test(`${owner}/${kind}-${'11'.repeat(16)}.${extension}`))
      assert.ok(pattern.test(`${owner}/${kind}-11111111-1111-4111-8111-111111111111.${extension}`))
      assert.ok(!pattern.test(`bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/${kind}-11.${extension}`))
    }
    assert.ok(!pattern.test(`${owner}/${kind === 'avatar' ? 'cover' : 'avatar'}-11.png`))
    assert.ok(!pattern.test(`${owner}/${kind}-11.jpg`))
    assert.ok(!pattern.test(`${owner}/${kind}-11.png/extra`))
  }
  const storageRule = new RegExp(migration.match(/and name ~ '([^']+)'/)[1])
  assert.ok(storageRule.test(`${owner}/avatar-${'11'.repeat(16)}.png`))
  assert.ok(!storageRule.test(`${owner}/../avatar-11.png`))
  assert.ok(!storageRule.test(`${owner}/avatar-11.svg`))
  assert.match(migration, /private\.has_account\(\)/)
  assert.match(migration, /private\.owns_profile\(p\.id\)/)
  assert.match(migration, /p\.id::text = \(storage\.foldername\(name\)\)\[1\]/)
})
