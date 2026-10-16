import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { audioHarness } from '../game/audio-test-utils'
import type { AudioEngine } from '../game/audio'
import { Modal } from './Shared'
import { SoundSettings } from './SoundSettings'

beforeEach(() => { window.family100Audio = audioHarness().api as AudioEngine })
afterEach(() => { delete window.family100Audio })

it('offers a separately named preview button for every one of the 17 effects', () => {
  render(<SoundSettings />)
  fireEvent.click(screen.getByRole('button', { name: 'Pengaturan Suara' }))
  expect(screen.getByRole('heading', { name: 'Galeri Efek Suara' })).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: /^Putar / })).toHaveLength(17)
})

it('connects every named Putar button to its own real engine effect', async () => {
  const engine = window.family100Audio!
  const preview = vi.spyOn(engine, 'preview')
  render(<SoundSettings />)
  fireEvent.click(screen.getByRole('button', { name: 'Pengaturan Suara' }))
  for (const effect of engine.getEffects()) {
    fireEvent.click(screen.getByRole('button', { name: `Putar ${effect.label}` }))
    await waitFor(() => expect(preview).toHaveBeenLastCalledWith(effect.id))
    await screen.findByText(`${effect.label} diputar. Sesuaikan juga volume perangkat Anda.`)
  }
  expect(preview).toHaveBeenCalledTimes(17)
})

it('disables all previews and the existing test at mute or zero volume', () => {
  render(<SoundSettings />)
  fireEvent.click(screen.getByRole('button', { name: 'Pengaturan Suara' }))
  const buttons = [...screen.getAllByRole('button', { name: /^Putar / }), screen.getByRole('button', { name: 'Tes Suara' })]
  fireEvent.click(screen.getByRole('checkbox', { name: 'Efek suara' }))
  for (const button of buttons) expect(button).toBeDisabled()
  fireEvent.click(screen.getByRole('checkbox', { name: 'Efek suara' }))
  fireEvent.change(screen.getByRole('slider', { name: 'Volume utama' }), { target: { value: '0' } })
  for (const button of buttons) expect(button).toBeDisabled()
  fireEvent.change(screen.getByRole('slider', { name: 'Volume utama' }), { target: { value: '45' } })
  for (const button of buttons) expect(button).toBeEnabled()
  expect(window.family100Audio!.getSettings().volume).toBe(45)
})

it('Escape closes only the sound dialog and preserves the parent game-settings dialog', () => {
  const closeGameSettings = vi.fn()
  render(<Modal title="Game settings" onClose={closeGameSettings}><SoundSettings /></Modal>)
  fireEvent.click(screen.getByRole('button', { name: 'Pengaturan Suara' }))
  fireEvent(screen.getByRole('dialog', { name: 'Pengaturan Suara' }), new Event('cancel', { cancelable: true }))
  expect(closeGameSettings).not.toHaveBeenCalled()
  expect(screen.getByRole('heading', { name: 'Game settings' }).closest('dialog')).toHaveAttribute('open')
  expect(screen.queryByRole('dialog', { name: 'Pengaturan Suara' })).not.toBeInTheDocument()
})
