import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PlaygroundPage from '@/app/(main)/playground/page';

describe('PlaygroundPage', () => {
  it('renders playground UI and active agents list', () => {
    render(<PlaygroundPage />);
    
    expect(screen.getByText('Active Agents')).toBeInTheDocument();
    // Active agents sidebar items
    const agents = screen.getAllByText('Code Reviewer Pro');
    expect(agents.length).toBeGreaterThan(0);
  });

  it('handles chat input and submission', () => {
    render(<PlaygroundPage />);
    
    const input = screen.getByPlaceholderText('Message your agent...');
    
    // Type a message
    fireEvent.change(input, { target: { value: 'Hello agent' } });
    expect(input).toHaveValue('Hello agent');
    
    // Send message using Enter key
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 });
    
    // The message should appear in the chat log
    expect(screen.getByText('Hello agent')).toBeInTheDocument();
    
    // Input should be cleared after sending
    expect(input).toHaveValue('');
  });
});
