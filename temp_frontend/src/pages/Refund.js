import React, { useState, useEffect, useContext } from 'react';
import apiService from '../services/api';
import { AuthContext } from '../context/AuthContext';
import Alert from '../components/Alert';
import Spinner from '../components/Spinner';

const Refund = () => {
  const [utxos, setUtxos] = useState([]);
  const [selectedUtxo, setSelectedUtxo] = useState(null);
  const [refundAddress, setRefundAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingUtxos, setFetchingUtxos] = useState(true);
  const [alert, setAlert] = useState({ type: '', message: '' });
  // eslint-disable-next-line no-unused-vars
  const { currentUser } = useContext(AuthContext);

  // Fetch user's UTXOs on component mount
  useEffect(() => {
    const fetchUserUtxos = async () => {
      try {
        const response = await apiService.getUserUtxos();
        setUtxos(response.data);
      } catch (error) {
        console.error('Error fetching UTXOs:', error);
        setAlert({
          type: 'danger',
          message: 'Failed to fetch your UTXOs. Please try again.'
        });
      } finally {
        setFetchingUtxos(false);
      }
    };

    fetchUserUtxos();
  }, []);

  const handleRefundAddressChange = (e) => {
    setRefundAddress(e.target.value);
  };

  const handleUtxoSelect = (utxo) => {
    setSelectedUtxo(utxo);
  };

  const handleRefund = async () => {
    if (!selectedUtxo || !refundAddress) {
      setAlert({
        type: 'danger',
        message: 'Please select a UTXO and enter a refund address'
      });
      return;
    }

    setLoading(true);
    setAlert({ type: '', message: '' });

    try {
      // Create a mock ZK proof for demo purposes
      const mockZkProof = {
        proof: 'mock-zk-proof-data',
        publicInputs: {
          commitment: 'mock-commitment-hash'
        },
        isValid: true
      };

      // Call refund API
      const response = await apiService.refund({
        utxo: {
          txHash: selectedUtxo.txHash,
          outputIndex: selectedUtxo.outputIndex
        },
        ownerAddress: refundAddress,
        zkProof: mockZkProof
      });

      // Handle successful refund
      setAlert({
        type: 'success',
        message: `Refund issued successfully! Transaction hash: ${response.data.txHash}`
      });

      // Remove the refunded UTXO from the list
      setUtxos(utxos.filter(utxo => 
        utxo.txHash !== selectedUtxo.txHash || 
        utxo.outputIndex !== selectedUtxo.outputIndex
      ));
      setSelectedUtxo(null);
      setRefundAddress('');

    } catch (error) {
      console.error('Refund error:', error);
      setAlert({
        type: 'danger',
        message: error.response?.data?.error || 'Failed to issue refund. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h1>Refund UTXOs</h1>
      <Alert type={alert.type} message={alert.message} />

      {fetchingUtxos ? (
        <div>
          <p>Loading your UTXOs...</p>
          <Spinner />
        </div>
      ) : utxos.length === 0 ? (
        <p>You don't have any UTXOs available for refund.</p>
      ) : (
        <>
          <h2>Select a UTXO to Refund</h2>
          <div style={{ marginBottom: '20px' }}>
            {utxos.map((utxo, index) => (
              <div 
                key={`${utxo.txHash}-${utxo.outputIndex}`}
                className="card" 
                style={{ 
                  padding: '10px', 
                  marginBottom: '10px',
                  cursor: 'pointer',
                  backgroundColor: selectedUtxo === utxo ? '#e6f7ff' : 'white'
                }}
                onClick={() => handleUtxoSelect(utxo)}
              >
                <p><strong>UTXO #{index + 1}</strong></p>
                <p><strong>Transaction Hash:</strong> {utxo.txHash.substring(0, 15)}...</p>
                <p><strong>Output Index:</strong> {utxo.outputIndex}</p>
                <p><strong>Amount:</strong> {utxo.amount || 'N/A'} ADA</p>
                <p><strong>Refunded:</strong> {utxo.refunded ? 'Yes' : 'No'}</p>
              </div>
            ))}
          </div>

          <div className="form-group">
            <label htmlFor="refundAddress">Refund Address</label>
            <input
              type="text"
              id="refundAddress"
              value={refundAddress}
              onChange={handleRefundAddressChange}
              placeholder="addr_test1..."
              required
            />
          </div>

          <button 
            onClick={handleRefund} 
            disabled={loading || !selectedUtxo || !refundAddress}
          >
            {loading ? 'Processing Refund...' : 'Issue Refund'}
          </button>
          
          {loading && <Spinner size="small" />}
        </>
      )}
    </div>
  );
};

export default Refund;