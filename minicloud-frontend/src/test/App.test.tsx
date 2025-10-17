import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'

describe('LoadingSpinner', () => {
  it('renders loading spinner', () => {
    render(<LoadingSpinner />)
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<LoadingSpinner className="custom-class" />)
    expect(document.querySelector('.custom-class')).toBeInTheDocument()
  })
})