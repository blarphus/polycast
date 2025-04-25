import React from 'react';
import { render, screen } from '@testing-library/react';
import TranscriptionDisplay from './TranscriptionDisplay';
import '@testing-library/jest-dom';

describe('TranscriptionDisplay', () => {
  it('renders without crashing', () => {
    render(<TranscriptionDisplay messages={[]} />);
    expect(screen.getByRole('heading', { name: /Live Transcription \/ Translation/i })).toBeInTheDocument();
  });

  it('displays "Waiting for transcription..." when messages array is empty', () => {
    render(<TranscriptionDisplay messages={[]} />);
    expect(screen.getByText(/Waiting for transcription.../i)).toBeInTheDocument();
  });

  it('renders a list of string messages', () => {
    const testMessages = ['Hello there.', 'This is a test message.'];
    render(<TranscriptionDisplay messages={testMessages} />);

    expect(screen.getByText('Hello there.')).toBeInTheDocument();
    expect(screen.getByText('This is a test message.')).toBeInTheDocument();
    // Check if they are list items
    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(2);
  });

  it('renders a list of object messages (stringified)', () => {
    const testMessages = [{ text: 'Object message 1' }, { text: 'Object message 2' }];
    render(<TranscriptionDisplay messages={testMessages} />);

    expect(screen.getByText(JSON.stringify(testMessages[0]))).toBeInTheDocument();
    expect(screen.getByText(JSON.stringify(testMessages[1]))).toBeInTheDocument();
    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(2);
  });
}); 