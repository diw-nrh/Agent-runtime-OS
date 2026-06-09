import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import MarketplacePage from '@/app/(main)/marketplace/page';

describe('MarketplacePage', () => {
  it('renders the marketplace title and mock items', () => {
    render(<MarketplacePage />);
    
    expect(screen.getByText('Marketplace')).toBeInTheDocument();
    expect(screen.getByText('Discover and install new AI Agents and MCP Tools.')).toBeInTheDocument();
    
    // Check if mock items are rendered
    expect(screen.getByText('Code Reviewer Pro')).toBeInTheDocument();
    expect(screen.getByText('SQL Query Builder')).toBeInTheDocument();
  });

  it('filters items based on search input', () => {
    render(<MarketplacePage />);
    
    const searchInput = screen.getByPlaceholderText('Search...');
    fireEvent.change(searchInput, { target: { value: 'SQL' } });
    
    // SQL Query Builder should remain
    expect(screen.getByText('SQL Query Builder')).toBeInTheDocument();
    // Code Reviewer Pro should be filtered out
    expect(screen.queryByText('Code Reviewer Pro')).not.toBeInTheDocument();
  });
});
