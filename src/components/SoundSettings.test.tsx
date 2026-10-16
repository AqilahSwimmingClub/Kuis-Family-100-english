import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { Modal } from './Shared'
import { SoundSettings } from './SoundSettings'

it('Escape closes only the sound dialog and preserves the parent game-settings dialog', () => {
  const closeGameSettings = vi.fn()
  render(<Modal title="Game settings" onClose={closeGameSettings}><SoundSettings /></Modal>)
  fireEvent.click(screen.getByRole('button', { name: 'Pengaturan Suara' }))
  fireEvent(screen.getByRole('dialog', { name: 'Pengaturan Suara' }), new Event('cancel', { cancelable: true }))
  expect(closeGameSettings).not.toHaveBeenCalled()
  expect(screen.getByRole('heading', { name: 'Game settings' }).closest('dialog')).toHaveAttribute('open')
  expect(screen.queryByRole('dialog', { name: 'Pengaturan Suara' })).not.toBeInTheDocument()
})
