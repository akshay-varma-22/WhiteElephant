// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Testimonials from '../../src/components/Testimonials.jsx';
import { TESTIMONIALS } from '../../src/data/testimonials.js';

// The photo component pulls in the whole image pipeline; a stub keeps this test about the testimonials only.
vi.mock('../../src/components/Photo.jsx', () => ({ default: () => null }));

afterEach(cleanup);

const SAMPLE = [
  { quote: 'First quote from a test client.', name: 'Test Person One', role: 'Homeowner, Testville' },
  { quote: 'Second quote from another test client.', name: 'Test Person Two', role: 'Office manager, Testville' },
];

describe('Testimonials', () => {
  it('ships with no testimonials, so the section is hidden until real ones are added', () => {
    expect(TESTIMONIALS).toEqual([]);
    const { container } = render(<Testimonials />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a single testimonial without carousel controls', () => {
    render(<Testimonials items={[SAMPLE[0]]} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Spaces that feel right.' })).toBeInTheDocument();
    expect(screen.getByText('First quote from a test client.')).toBeInTheDocument();
    expect(screen.getByText('Test Person One')).toBeInTheDocument();
    expect(screen.getByText('Homeowner, Testville')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /next testimonial/i })).toBeNull();
  });

  it('moves between testimonials with the arrows and the dots', async () => {
    const user = userEvent.setup();
    render(<Testimonials items={SAMPLE} />);
    expect(screen.getByText('First quote from a test client.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /next testimonial/i }));
    expect(screen.getByText('Second quote from another test client.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /next testimonial/i })); // wraps around
    expect(screen.getByText('First quote from a test client.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /previous testimonial/i })); // wraps back
    expect(screen.getByText('Second quote from another test client.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /show testimonial 1 of 2/i }));
    expect(screen.getByText('First quote from a test client.')).toBeInTheDocument();
  });

  it('shows initials when a testimonial has no photo', () => {
    render(<Testimonials items={[SAMPLE[0]]} />);
    expect(screen.getByText('TP')).toBeInTheDocument();
  });
});
