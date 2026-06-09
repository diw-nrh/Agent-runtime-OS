import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { AgentNode } from '../src/components/canvas/AgentNode'

// Mock react flow's Handle component since we are testing outside a ReactFlow provider
jest.mock('@xyflow/react', () => {
  const originalModule = jest.requireActual('@xyflow/react');
  return {
    __esModule: true,
    ...originalModule,
    Handle: () => <div data-testid="mock-handle" />,
    useReactFlow: () => ({ updateNodeData: jest.fn() })
  };
});

describe('AgentNode', () => {
  it('renders the agent node with provided label and model', () => {
    const mockData = {
      label: 'Test Researcher Agent',
      model: 'openai/gpt-4o'
    }

    render(<AgentNode id="agent-1" data={mockData} />)

    // Check if the label is rendered in the input field
    expect(screen.getByDisplayValue('Test Researcher Agent')).toBeInTheDocument()

    // Check if the model is rendered in the input field
    expect(screen.getByDisplayValue('openai/gpt-4o')).toBeInTheDocument()
    
    // Check handles
    expect(screen.getAllByTestId('mock-handle')).toHaveLength(2)
  })
})
