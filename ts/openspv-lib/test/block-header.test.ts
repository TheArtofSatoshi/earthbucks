import { describe, expect, test, beforeEach, it } from '@jest/globals'
import BlockHeader from '../src/block-header'

describe('BlockHeader', () => {
  test('toU8Vec and fromU8Vec', () => {
    const bh1 = new BlockHeader(
      1,
      new Uint8Array(32),
      new Uint8Array(32),
      0n,
      new Uint8Array(32),
      new Uint8Array(32),
      0n,
    )
    const buf = bh1.toU8Vec()
    const bh2 = BlockHeader.fromU8Vec(buf)
    expect(bh1.version).toBe(bh2.version)
    expect(bh1.previousBlockId).toEqual(bh2.previousBlockId)
    expect(bh1.merkleRoot).toEqual(bh2.merkleRoot)
    expect(bh1.timestamp).toBe(bh2.timestamp)
    expect(bh1.target).toEqual(bh2.target)
    expect(bh1.nonce).toEqual(bh2.nonce)
    expect(bh1.index).toBe(bh2.index)
  })

  test('toBuffer', () => {
    const bh1 = new BlockHeader(
      1,
      new Uint8Array(32),
      new Uint8Array(32),
      0n,
      new Uint8Array(32),
      new Uint8Array(32),
      0n,
    )
    const buf = bh1.toBuffer()
    const bh2 = BlockHeader.fromU8Vec(new Uint8Array(buf))
    expect(bh1.version).toBe(bh2.version)
    expect(bh1.previousBlockId).toEqual(bh2.previousBlockId)
    expect(bh1.merkleRoot).toEqual(bh2.merkleRoot)
    expect(bh1.timestamp).toBe(bh2.timestamp)
    expect(bh1.target).toEqual(bh2.target)
    expect(bh1.nonce).toEqual(bh2.nonce)
    expect(bh1.index).toBe(bh2.index)
  })

  test('isValid', () => {
    const bh1 = new BlockHeader(
      1,
      new Uint8Array(32),
      new Uint8Array(32),
      0n,
      new Uint8Array(32),
      new Uint8Array(32),
      0n,
    )
    expect(bh1.isValid()).toBe(true)
  })

  test('isGenesis', () => {
    const bh1 = new BlockHeader(
      1,
      new Uint8Array(32),
      new Uint8Array(32),
      0n,
      new Uint8Array(32),
      new Uint8Array(32),
      0n,
    )
    expect(bh1.isGenesis()).toBe(true)
  })

  test('hash', () => {
    const bh1 = new BlockHeader(
      1,
      new Uint8Array(32),
      new Uint8Array(32),
      0n,
      new Uint8Array(32),
      new Uint8Array(32),
      0n,
    )
    expect(Buffer.from(bh1.hash()).toString('hex')).toBe(
      'ec821c0b0375d4e80eca5fb437652b2d53f32a613d4349d665a67406ba0d239e',
    )
  })

  test('id', () => {
    const bh1 = new BlockHeader(
      1,
      new Uint8Array(32),
      new Uint8Array(32),
      0n,
      new Uint8Array(32),
      new Uint8Array(32),
      0n,
    )
    expect(Buffer.from(bh1.id()).toString('hex')).toBe(
      '8bbebda6265eb4265ff52f6e744d2859e6ef58c640e1df355072c4a9541b8aba',
    )
  })
})
