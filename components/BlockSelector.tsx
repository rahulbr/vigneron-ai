
import React, { useState, useEffect } from 'react';
import { Block, getPropertyBlocks, createBlock } from '../lib/supabase';

interface BlockSelectorProps {
  propertyId: string;
  selectedBlockIds: string[];
  onBlocksChange: (blockIds: string[]) => void;
  disabled?: boolean;
}

export const BlockSelector: React.FC<BlockSelectorProps> = ({
  propertyId,
  selectedBlockIds,
  onBlocksChange,
  disabled = false
}) => {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateBlock, setShowCreateBlock] = useState(false);
  const [newBlockName, setNewBlockName] = useState('');
  const [newBlockVarietal, setNewBlockVarietal] = useState('');

  useEffect(() => {
    loadBlocks();
  }, [propertyId]);

  const loadBlocks = async () => {
    try {
      setLoading(true);
      const propertyBlocks = await getPropertyBlocks(propertyId);
      setBlocks(propertyBlocks);
    } catch (error) {
      console.error('Error loading blocks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBlockToggle = (blockId: string) => {
    if (disabled) return;
    
    const newSelectedIds = selectedBlockIds.includes(blockId)
      ? selectedBlockIds.filter(id => id !== blockId)
      : [...selectedBlockIds, blockId];
    
    onBlocksChange(newSelectedIds);
  };

  const handleCreateBlock = async () => {
    if (!newBlockName.trim()) return;

    try {
      const newBlock = await createBlock(
        propertyId,
        newBlockName.trim(),
        newBlockVarietal.trim() || undefined
      );
      
      setBlocks([...blocks, newBlock]);
      setNewBlockName('');
      setNewBlockVarietal('');
      setShowCreateBlock(false);
      
      // Auto-select the new block
      onBlocksChange([...selectedBlockIds, newBlock.id]);
    } catch (error) {
      console.error('Error creating block:', error);
      alert('Failed to create block. Please try again.');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '10px', textAlign: 'center' }}>
        Loading blocks...
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '15px' }}>
      <label style={{ 
        display: 'block', 
        marginBottom: '8px', 
        fontWeight: '500',
        color: '#374151'
      }}>
        Select Block(s) *
      </label>
      
      {blocks.length === 0 ? (
        <div style={{
          padding: '15px',
          backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          textAlign: 'center'
        }}>
          <p style={{ margin: '0 0 10px 0', color: '#6b7280' }}>
            No blocks found for this property.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateBlock(true)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Create First Block
          </button>
        </div>
      ) : (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '8px',
            marginBottom: '10px',
            maxHeight: '200px',
            overflowY: 'auto',
            padding: '8px',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            backgroundColor: '#f9fafb'
          }}>
            {blocks.map((block) => (
              <label
                key={block.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px',
                  backgroundColor: selectedBlockIds.includes(block.id) ? '#dbeafe' : 'white',
                  border: selectedBlockIds.includes(block.id) ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                  borderRadius: '4px',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.6 : 1
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedBlockIds.includes(block.id)}
                  onChange={() => handleBlockToggle(block.id)}
                  disabled={disabled}
                  style={{ marginRight: '8px' }}
                />
                <div>
                  <div style={{ fontWeight: '500', fontSize: '14px' }}>
                    {block.name}
                  </div>
                  {block.varietal && (
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {block.varietal}
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
          
          <button
            type="button"
            onClick={() => setShowCreateBlock(true)}
            style={{
              padding: '6px 12px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            + Add New Block
          </button>
        </>
      )}

      {showCreateBlock && (
        <div style={{
          marginTop: '10px',
          padding: '15px',
          backgroundColor: '#f0f9ff',
          border: '1px solid #0ea5e9',
          borderRadius: '6px'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#0369a1' }}>Create New Block</h4>
          
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>
              Block Name *
            </label>
            <input
              type="text"
              value={newBlockName}
              onChange={(e) => setNewBlockName(e.target.value)}
              placeholder="e.g., A1, B2, Pinot Block"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px'
              }}
            />
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>
              Varietal (Optional)
            </label>
            <input
              type="text"
              value={newBlockVarietal}
              onChange={(e) => setNewBlockVarietal(e.target.value)}
              placeholder="e.g., Pinot Noir, Chardonnay"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px'
              }}
            />
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={handleCreateBlock}
              disabled={!newBlockName.trim()}
              style={{
                padding: '8px 16px',
                backgroundColor: newBlockName.trim() ? '#10b981' : '#9ca3af',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: newBlockName.trim() ? 'pointer' : 'not-allowed'
              }}
            >
              Create Block
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreateBlock(false);
                setNewBlockName('');
                setNewBlockVarietal('');
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      {selectedBlockIds.length === 0 && !disabled && (
        <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#ef4444' }}>
          Please select at least one block
        </p>
      )}
    </div>
  );
};

export default BlockSelector;
