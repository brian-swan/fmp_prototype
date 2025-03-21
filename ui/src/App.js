import React, { useState, useEffect } from 'react';
import axios from 'axios';

// API client
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000', // 'http://feature-api:8000',
  headers: {
    'X-API-Key': 'test-api-key',
    'Content-Type': 'application/json'
  }
});

function FeatureFlagAdmin() {
  const [flags, setFlags] = useState([]);
  const [selectedFlag, setSelectedFlag] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchFlags();
  }, []);

  const fetchFlags = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/v1/flags');
      setFlags(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to load feature flags');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectFlag = (flag) => {
    setSelectedFlag(flag);
    setIsEditing(false);
  };

  const toggleFlagStatus = async (flag) => {
    try {
      const updatedFlag = { ...flag, enabled: !flag.enabled };
      await api.put(`/api/v1/flags/${flag.key}`, updatedFlag);
      
      // Update local state
      setFlags(flags.map(f => f.key === flag.key ? { ...f, enabled: !f.enabled } : f));
      
      if (selectedFlag && selectedFlag.key === flag.key) {
        setSelectedFlag({ ...selectedFlag, enabled: !selectedFlag.enabled });
      }
    } catch (err) {
      setError('Failed to update flag status');
      console.error(err);
    }
  };

  const saveFlag = async (updatedFlag) => {
    try {
      await api.put(`/api/v1/flags/${updatedFlag.key}`, updatedFlag);
      
      // Update local state
      setFlags(flags.map(f => f.key === updatedFlag.key ? updatedFlag : f));
      setSelectedFlag(updatedFlag);
      setIsEditing(false);
      setError(null);
    } catch (err) {
      setError('Failed to save flag');
      console.error(err);
    }
  };

  const createFlag = async (newFlag) => {
    try {
      // Ensure all required fields are present according to the API model
      const now = new Date().toISOString();
      const completeFlag = {
        ...newFlag,
        id: newFlag.id || `flag-${Date.now()}`, // Generate an ID if not provided
        created_at: now,
        updated_at: now
      };
      
      console.log('Sending to API:', completeFlag);
      const response = await api.post('/api/v1/flags', completeFlag);
      
      // Update local state
      setFlags([...flags, response.data]);
      setSelectedFlag(response.data);
      setIsEditing(false);
      setError(null);
    } catch (err) {
      console.error('API Error Response:', err.response?.data);
      setError(`Failed to create flag: ${err.response?.data?.detail || err.message}`);
      console.error(err);
    }
  };

  const deleteFlag = async (flagKey) => {
    if (!window.confirm(`Are you sure you want to delete the flag "${flagKey}"?`)) {
      return;
    }
    
    try {
      await api.delete(`/api/v1/flags/${flagKey}`);
      
      // Update local state
      setFlags(flags.filter(f => f.key !== flagKey));
      
      if (selectedFlag && selectedFlag.key === flagKey) {
        setSelectedFlag(null);
      }
    } catch (err) {
      setError('Failed to delete flag');
      console.error(err);
    }
  };

  return (
    <div className="feature-flag-admin">
      <header>
        <h1>Feature Flag Management</h1>
      </header>
      
      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}
      
      <div className="admin-layout">
        <div className="flag-list">
          <h2>Feature Flags</h2>
          
          <button 
            className="create-button"
            onClick={() => {
              const timestamp = Date.now();
              setSelectedFlag({
                id: `flag-${timestamp}`, // Add the required ID field
                key: '',
                name: '',
                description: '',
                enabled: true,
                variations: [
                  { id: `var-${timestamp}-1`, name: 'On', value: { type: 'boolean', value: true } },
                  { id: `var-${timestamp}-2`, name: 'Off', value: { type: 'boolean', value: false } }
                ],
                default_variation_id: `var-${timestamp}-1`, // Set a default variation ID
                rules: [],
                created_at: new Date().toISOString(), // Add the required date fields
                updated_at: new Date().toISOString()
              });
              setIsEditing(true);
            }}
          >
            Create New Flag
          </button>
          
          {loading ? (
            <div>Loading flags...</div>
          ) : (
            <ul>
              {flags.map(flag => (
                <li key={flag.key} className={selectedFlag && selectedFlag.key === flag.key ? 'selected' : ''}>
                  <div className="flag-item" onClick={() => selectFlag(flag)}>
                    <span className="flag-name">{flag.name}</span>
                    <div className="flag-status">
                      <label className="toggle">
                        <input 
                          type="checkbox" 
                          checked={flag.enabled} 
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleFlagStatus(flag);
                          }}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        
        <div className="flag-details">
          {selectedFlag ? (
            isEditing ? (
              <FlagEditor 
                flag={selectedFlag} 
                onSave={(flag) => selectedFlag.key ? saveFlag(flag) : createFlag(flag)} 
                onCancel={() => {
                  setIsEditing(false);
                  if (!selectedFlag.key) {
                    setSelectedFlag(null);
                  }
                }}
              />
            ) : (
              <FlagDetail 
                flag={selectedFlag} 
                onEdit={() => setIsEditing(true)} 
                onDelete={() => deleteFlag(selectedFlag.key)}
                onToggleStatus={() => toggleFlagStatus(selectedFlag)}
              />
            )
          ) : (
            <div className="no-selection">
              <p>Select a feature flag or create a new one</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FlagDetail({ flag, onEdit, onDelete, onToggleStatus }) {
  return (
    <div className="flag-detail">
      <div className="detail-header">
        <h2>{flag.name}</h2>
        <div className="actions">
          <button onClick={onEdit}>Edit</button>
          <button className="delete" onClick={onDelete}>Delete</button>
          <label className="toggle">
            <input type="checkbox" checked={flag.enabled} onChange={onToggleStatus} />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>
      
      <div className="detail-body">
        <div className="detail-section">
          <h3>Basic Information</h3>
          <div className="detail-item">
            <span className="label">Key:</span>
            <span className="value">{flag.key}</span>
          </div>
          <div className="detail-item">
            <span className="label">Description:</span>
            <span className="value">{flag.description || 'No description'}</span>
          </div>
          <div className="detail-item">
            <span className="label">Created:</span>
            <span className="value">{new Date(flag.created_at).toLocaleString()}</span>
          </div>
          <div className="detail-item">
            <span className="label">Last Updated:</span>
            <span className="value">{new Date(flag.updated_at).toLocaleString()}</span>
          </div>
        </div>
        
        <div className="detail-section">
          <h3>Variations</h3>
          <table className="variations-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Value</th>
                <th>Default</th>
              </tr>
            </thead>
            <tbody>
              {flag.variations.map(variation => (
                <tr key={variation.id}>
                  <td>{variation.id}</td>
                  <td>{variation.name}</td>
                  <td>{JSON.stringify(variation.value.value)}</td>
                  <td>{variation.id === flag.default_variation_id ? '✓' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="detail-section">
          <h3>Targeting Rules</h3>
          {flag.rules && flag.rules.length > 0 ? (
            <div className="rules-list">
              {flag.rules.map((rule, index) => (
                <div key={rule.id || index} className="rule-item">
                  <h4>Rule {index + 1}</h4>
                  <div className="rule-details">
                    <div className="rule-detail">
                      <span className="label">Type:</span>
                      <span className="value">{rule.type}</span>
                    </div>
                    {rule.type === 'user' && (
                      <div className="rule-detail">
                        <span className="label">User IDs:</span>
                        <span className="value">{rule.user_ids.join(', ')}</span>
                      </div>
                    )}
                    {rule.type === 'percentage' && (
                      <div className="rule-detail">
                        <span className="label">Percentage:</span>
                        <span className="value">{rule.percentage}%</span>
                      </div>
                    )}
                    {rule.type === 'attribute' && (
                      <>
                        <div className="rule-detail">
                          <span className="label">Attribute:</span>
                          <span className="value">{rule.attribute}</span>
                        </div>
                        <div className="rule-detail">
                          <span className="label">Operator:</span>
                          <span className="value">{rule.operator}</span>
                        </div>
                        <div className="rule-detail">
                          <span className="label">Value:</span>
                          <span className="value">{JSON.stringify(rule.value)}</span>
                        </div>
                      </>
                    )}
                    <div className="rule-detail">
                      <span className="label">Serves:</span>
                      <span className="value">
                        {flag.variations.find(v => v.id === rule.variation_id)?.name || 'Unknown'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>No targeting rules defined</p>
          )}
        </div>
      </div>
    </div>
  );
}

function FlagEditor({ flag, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    ...flag,
    variations: [...flag.variations],
    rules: [...(flag.rules || [])]
  });
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleVariationChange = (index, field, value) => {
    const updatedVariations = [...formData.variations];
    updatedVariations[index] = {
      ...updatedVariations[index],
      [field]: value
    };
    setFormData({
      ...formData,
      variations: updatedVariations
    });
  };

  const handleVariationValueChange = (index, value) => {
    const updatedVariations = [...formData.variations];
    const variation = updatedVariations[index];
    const valueType = variation.value.type;
    
    let parsedValue;
    try {
      if (valueType === 'boolean') {
        parsedValue = value === 'true';
      } else if (valueType === 'number') {
        parsedValue = parseFloat(value);
      } else if (valueType === 'json') {
        parsedValue = JSON.parse(value);
      } else {
        parsedValue = value;
      }
      
      updatedVariations[index] = {
        ...variation,
        value: {
          ...variation.value,
          value: parsedValue
        }
      };
      
      setFormData({
        ...formData,
        variations: updatedVariations
      });
      setError(null);
    } catch (err) {
      setError(`Invalid value for ${valueType}: ${err.message}`);
    }
  };

  const handleVariationTypeChange = (index, type) => {
    const updatedVariations = [...formData.variations];
    const variation = updatedVariations[index];
    
    // Convert the value to the new type
    let newValue;
    switch (type) {
      case 'boolean':
        newValue = Boolean(variation.value.value);
        break;
      case 'number':
        newValue = isNaN(parseFloat(variation.value.value)) ? 0 : parseFloat(variation.value.value);
        break;
      case 'string':
        newValue = String(variation.value.value);
        break;
      case 'json':
        newValue = typeof variation.value.value === 'object' ? 
          variation.value.value : 
          { value: variation.value.value };
        break;
      default:
        newValue = variation.value.value;
    }
    
    updatedVariations[index] = {
      ...variation,
      value: {
        type,
        value: newValue
      }
    };
    
    setFormData({
      ...formData,
      variations: updatedVariations
    });
  };

  const addVariation = () => {
    const newVariation = {
      id: `var-${Date.now()}`,
      name: `Variation ${formData.variations.length + 1}`,
      value: {
        type: 'boolean',
        value: false
      }
    };
    
    setFormData({
      ...formData,
      variations: [...formData.variations, newVariation]
    });
  };

  const removeVariation = (index) => {
    if (formData.variations.length <= 1) {
      setError('Cannot remove the last variation');
      return;
    }
    
    const updatedVariations = [...formData.variations];
    const removedVariation = updatedVariations[index];
    updatedVariations.splice(index, 1);
    
    // Update default variation if it was removed
    let updatedDefaultVariation = formData.default_variation_id;
    if (removedVariation.id === formData.default_variation_id) {
      updatedDefaultVariation = updatedVariations[0].id;
    }
    
    setFormData({
      ...formData,
      variations: updatedVariations,
      default_variation_id: updatedDefaultVariation
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate form data
    if (!formData.key) {
      setError('Flag key is required');
      return;
    }
    
    if (!formData.name) {
      setError('Flag name is required');
      return;
    }
    
    if (!formData.default_variation_id) {
      setError('Default variation must be selected');
      return;
    }
    
    // Validate variations
    if (formData.variations.length === 0) {
      setError('At least one variation is required');
      return;
    }
    
    for (const variation of formData.variations) {
      if (!variation.name) {
        setError('All variations must have a name');
        return;
      }
    }
    
    // Prepare data for saving
    const now = new Date().toISOString();
    const flagToSave = {
      ...formData,
      id: formData.id || `flag-${Date.now()}`, // Ensure we have an ID
      created_at: formData.created_at || now,
      updated_at: now
    };
    
    onSave(flagToSave);
  };

  return (
    <div className="flag-editor">
      <h2>{flag.key ? 'Edit Flag' : 'Create New Flag'}</h2>
      
      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="form-section">
          <h3>Basic Information</h3>
          
          <div className="form-row">
            <label>
              Flag Key:
              <input 
                type="text" 
                name="key" 
                value={formData.key} 
                onChange={handleChange}
                placeholder="unique-flag-key"
                required
                disabled={!!flag.key}  // Disable editing key for existing flags
              />
            </label>
          </div>
          
          <div className="form-row">
            <label>
              Name:
              <input 
                type="text" 
                name="name" 
                value={formData.name} 
                onChange={handleChange}
                placeholder="Flag Name"
                required
              />
            </label>
          </div>
          
          <div className="form-row">
            <label>
              Description:
              <textarea 
                name="description" 
                value={formData.description || ''} 
                onChange={handleChange}
                placeholder="Description of what this flag controls"
              />
            </label>
          </div>
          
          <div className="form-row">
            <label className="checkbox-label">
              <input 
                type="checkbox" 
                name="enabled" 
                checked={formData.enabled} 
                onChange={(e) => setFormData({...formData, enabled: e.target.checked})}
              />
              Enabled
            </label>
          </div>
        </div>
        
        <div className="form-section">
          <h3>Variations</h3>
          
          {formData.variations.map((variation, index) => (
            <div key={variation.id} className="variation-row">
              <div className="variation-header">
                <h4>Variation {index + 1}</h4>
                <button 
                  type="button" 
                  className="remove-button"
                  onClick={() => removeVariation(index)}
                >
                  Remove
                </button>
              </div>
              
              <div className="variation-fields">
                <div className="form-row">
                  <label>
                    Name:
                    <input 
                      type="text" 
                      value={variation.name} 
                      onChange={(e) => handleVariationChange(index, 'name', e.target.value)}
                      required
                    />
                  </label>
                </div>
                
                <div className="form-row">
                  <label>
                    Value Type:
                    <select 
                      value={variation.value.type} 
                      onChange={(e) => handleVariationTypeChange(index, e.target.value)}
                    >
                      <option value="boolean">Boolean</option>
                      <option value="string">String</option>
                      <option value="number">Number</option>
                      <option value="json">JSON</option>
                    </select>
                  </label>
                </div>
                
                <div className="form-row">
                  <label>
                    Value:
                    {variation.value.type === 'boolean' ? (
                      <select 
                        value={variation.value.value.toString()} 
                        onChange={(e) => handleVariationValueChange(index, e.target.value)}
                      >
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    ) : variation.value.type === 'json' ? (
                      <textarea 
                        value={JSON.stringify(variation.value.value, null, 2)} 
                        onChange={(e) => handleVariationValueChange(index, e.target.value)}
                      />
                    ) : (
                      <input 
                        type={variation.value.type === 'number' ? 'number' : 'text'} 
                        value={variation.value.value.toString()} 
                        onChange={(e) => handleVariationValueChange(index, e.target.value)}
                      />
                    )}
                  </label>
                </div>
                
                <div className="form-row">
                  <label className="radio-label">
                    <input 
                      type="radio" 
                      name="default_variation" 
                      checked={formData.default_variation_id === variation.id} 
                      onChange={() => setFormData({...formData, default_variation_id: variation.id})}
                      required
                    />
                    Default Variation
                  </label>
                </div>
              </div>
            </div>
          ))}
          
          <button type="button" className="add-button" onClick={addVariation}>
            Add Variation
          </button>
        </div>
        
        <div className="form-actions">
          <button type="submit" className="save-button">Save</button>
          <button type="button" className="cancel-button" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  );
}

export default FeatureFlagAdmin;
