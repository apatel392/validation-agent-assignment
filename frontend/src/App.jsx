import React, { useState, useEffect } from 'react';

const API_BASE = 'http://127.0.0.1:8000';

const customStyles = `
:root {
  --bg-color: #f9fafb;
  --text-color: #1f2937;
  --border-color: #e5e7eb;
  --primary: #3b82f6;
  --primary-hover: #2563eb;
  --success: #10b981;
  --success-light: #d1fae5;
  --danger: #ef4444;
  --danger-light: #fee2e2;
}
body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background-color: var(--bg-color); color: var(--text-color); }
.app-container { max-width: 1200px; margin: 0 auto; padding: 20px; }
header { margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--border-color); }
header h1 { margin: 0; font-size: 1.5rem; }
.main-content { display: flex; gap: 32px; align-items: flex-start; }
.validation-section, .crud-section { background: white; padding: 24px; border-radius: 8px; border: 1px solid var(--border-color); box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
.validation-section { flex: 2; }
.crud-section { flex: 1; }
h2 { margin-top: 0; font-size: 1.25rem; margin-bottom: 16px; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-weight: 500; margin-bottom: 8px; }
select, textarea, input[type="text"] { width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 4px; font-family: inherit; box-sizing: border-box; }
textarea { font-family: monospace; resize: vertical; }
button { cursor: pointer; padding: 10px 16px; border-radius: 4px; font-weight: 600; border: none; transition: background 0.2s; }
button:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-primary { background: var(--primary); color: white; width: 100%; }
.btn-primary:hover:not(:disabled) { background: var(--primary-hover); }
.btn-secondary { background: #e5e7eb; color: #374151; }
.btn-secondary:hover { background: #d1d5db; }
.btn-text { background: transparent; color: #6b7280; text-decoration: underline; padding: 0 8px; }
.btn-delete { background: transparent; color: var(--danger); border: 1px solid var(--danger); padding: 4px 8px; font-size: 0.875rem; }
.btn-delete:hover { background: var(--danger-light); }
.banner { padding: 12px 16px; border-radius: 4px; margin-top: 16px; font-weight: bold; }
.error-banner { background: var(--danger-light); color: #991b1b; border: 1px solid #f87171; }
.pass-banner { background: var(--success-light); color: #065f46; border: 1px solid #34d399; }
.fail-banner { background: var(--danger-light); color: #991b1b; border: 1px solid #f87171; }
.latency { font-weight: normal; font-size: 0.875rem; margin-left: 8px; opacity: 0.8; }
.errors-list h3, .summary-box h3 { font-size: 1rem; margin: 16px 0 8px 0; }
.errors-list ul { color: var(--danger); margin: 0; padding-left: 20px; }
.summary-box pre { background: var(--bg-color); padding: 12px; border-radius: 4px; border: 1px solid var(--border-color); margin: 0; white-space: pre-wrap; word-break: break-all; }
.save-form { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
.payloads-list { display: flex; flex-direction: column; gap: 8px; }
.payload-card { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-color); border: 1px solid var(--border-color); border-radius: 4px; }
.payload-info { cursor: pointer; display: flex; flex-direction: column; gap: 4px; }
.payload-info:hover strong { color: var(--primary); }
.badge { font-size: 0.75rem; background: #e5e7eb; padding: 2px 6px; border-radius: 10px; color: #4b5563; width: fit-content; }
.empty-state { color: #6b7280; font-style: italic; font-size: 0.875rem; }
@media (max-width: 768px) { .main-content { flex-direction: column; } .validation-section, .crud-section { width: 100%; box-sizing: border-box; } }
`;

function App() {
  // --- State: Validation ---
  const [jsonInput, setJsonInput] = useState('{\n  \n}');
  const [schema, setSchema] = useState('user_profile');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [generalError, setGeneralError] = useState(null);

  // --- State: CRUD ---
  const [savedPayloads, setSavedPayloads] = useState([]);
  const [payloadName, setPayloadName] = useState('');
  const [currentPayloadId, setCurrentPayloadId] = useState(null);

  // Load saved payloads on mount
  useEffect(() => {
    fetchPayloads();
  }, []);

  // --- API Calls: Validation ---
  const handleValidate = async () => {
    setGeneralError(null);
    setValidationResult(null);
    
    let parsedPayload;
    try {
      parsedPayload = JSON.parse(jsonInput);
    } catch (err) {
      setGeneralError('Invalid JSON format. Please check your syntax.');
      return;
    }

    setIsValidating(true);
    try {
      const response = await fetch(`${API_BASE}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schema: schema,
          payload: parsedPayload
        })
      });

      const data = await response.json();
      if (!response.ok) {
        setGeneralError(data.detail || 'The backend rejected the request.');
      } else {
        setValidationResult(data);
      }
    } catch (err) {
      setGeneralError('Failed to connect to the backend. Is your Python FastAPI server running at http://127.0.0.1:8000 ?');
    } finally {
      setIsValidating(false);
    }
  };

  // --- API Calls: CRUD ---
  const fetchPayloads = async () => {
    try {
      const res = await fetch(`${API_BASE}/payloads`);
      if (!res.ok) throw new Error('Network response was not ok');
      const data = await res.json();
      setSavedPayloads(data);
      if (generalError && generalError.includes('connect to the backend')) {
         setGeneralError(null);
      }
    } catch (err) {
      console.error("Failed to fetch payloads", err);
      setGeneralError("Failed to connect to the backend. Is your Python FastAPI server running at http://127.0.0.1:8000 ?");
    }
  };

  const handleSavePayload = async () => {
    if (!payloadName.trim()) {
      alert("Please enter a name for the payload");
      return;
    }

    let parsedPayload;
    try {
      parsedPayload = JSON.parse(jsonInput);
    } catch (err) {
      setGeneralError('Cannot save invalid JSON.');
      return;
    }

    const payloadObj = {
      name: payloadName,
      schema_type: schema,
      json_data: parsedPayload
    };

    try {
      if (currentPayloadId) {
        // Update existing
        await fetch(`${API_BASE}/payloads/${currentPayloadId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadObj)
        });
      } else {
        // Create new
        await fetch(`${API_BASE}/payloads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadObj)
        });
      }
      setPayloadName('');
      setCurrentPayloadId(null);
      fetchPayloads(); // Refresh list
    } catch (err) {
      setGeneralError('Failed to save payload. Is the backend running?');
    }
  };

  const handleLoadPayload = (item) => {
    setJsonInput(JSON.stringify(item.json, null, 2));
    setSchema(item.schema);
    setPayloadName(item.name);
    setCurrentPayloadId(item.id);
    setValidationResult(null);
    setGeneralError(null);
  };

  const handleDeletePayload = async (id) => {
    try {
      await fetch(`${API_BASE}/payloads/${id}`, { method: 'DELETE' });
      if (currentPayloadId === id) {
        setCurrentPayloadId(null);
        setPayloadName('');
      }
      fetchPayloads();
    } catch (err) {
      console.error("Failed to delete", err);
      setGeneralError("Failed to delete payload. Is the backend running?");
    }
  };

  return (
    <div className="app-container">
      <style>{customStyles}</style>
      <header>
        <h1>Validation Agent</h1>
      </header>

      <div className="main-content">
        {/* Left Column: Validation Form & Results */}
        <section className="validation-section">
          <h2>Validator</h2>
          
          <div className="form-group">
            <label htmlFor="schema-select">Schema</label>
            <select 
              id="schema-select" 
              value={schema} 
              onChange={(e) => setSchema(e.target.value)}
            >
              <option value="user_profile">User Profile</option>
              <option value="order">Order</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="json-input">JSON</label>
            <textarea
              id="json-input"
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              rows={12}
              placeholder="Paste JSON here..."
            />
          </div>

          <button 
            className="btn-primary" 
            onClick={handleValidate} 
            disabled={isValidating}
          >
            {isValidating ? 'Validating...' : 'Validate'}
          </button>

          {/* Error Banner for invalid JSON or network issues */}
          {generalError && (
            <div className="banner error-banner" role="alert">
              <strong>Error:</strong> {generalError}
            </div>
          )}

          {/* Results Panel */}
          {validationResult && (
            <div className="results-panel">
              <div className={`banner ${validationResult.ok ? 'pass-banner' : 'fail-banner'}`}>
                {validationResult.ok ? 'PASS' : 'FAIL'} 
                <span className="latency">({validationResult.latency_ms}ms)</span>
              </div>

              {!validationResult.ok && validationResult.errors.length > 0 && (
                <div className="errors-list">
                  <h3>Errors:</h3>
                  <ul>
                    {validationResult.errors.map((err, idx) => (
                      <li key={idx}><strong>{err.field}</strong>: {err.message}</li>
                    ))}
                  </ul>
                </div>
              )}

              {validationResult.ok && validationResult.summary && (
                <div className="summary-box">
                  <h3>Summary:</h3>
                  <pre>{JSON.stringify(validationResult.summary, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Right Column: CRUD Saved Payloads */}
        <section className="crud-section">
          <h2>Saved Payloads</h2>
          
          <div className="save-form">
            <input 
              type="text" 
              placeholder="Payload Name..." 
              value={payloadName}
              onChange={(e) => setPayloadName(e.target.value)}
            />
            <button className="btn-secondary" onClick={handleSavePayload}>
              {currentPayloadId ? 'Update Payload' : 'Save New Payload'}
            </button>
            {currentPayloadId && (
              <button className="btn-text" onClick={() => {
                setCurrentPayloadId(null);
                setPayloadName('');
              }}>Cancel Update</button>
            )}
          </div>

          <div className="payloads-list">
            {savedPayloads.length === 0 ? (
              <p className="empty-state">No payloads saved yet.</p>
            ) : (
              savedPayloads.map(item => (
                <div key={item.id} className="payload-card">
                  <div className="payload-info" onClick={() => handleLoadPayload(item)}>
                    <strong>{item.name}</strong>
                    <span className="badge">{item.schema}</span>
                  </div>
                  <button className="btn-delete" onClick={() => handleDeletePayload(item.id)}>
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;