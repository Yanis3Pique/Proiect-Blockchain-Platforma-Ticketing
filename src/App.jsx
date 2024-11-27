import { Web3ReactProvider } from '@web3-react/core';
import { ethers } from 'ethers';
import React from 'react';
import MainLayout from './components/MainLayout';

function getLibrary(provider) {
  return new ethers.providers.Web3Provider(provider);
}

function App() {
  React.useEffect(() => {
    if (typeof window.ethereum === 'undefined') {
      console.error('MetaMask is not installed!');
      alert('Please install MetaMask to use this application.');
    }
  }, []);

  return (
    <Web3ReactProvider getLibrary={getLibrary}>
      <MainLayout />
    </Web3ReactProvider>
  );
}

export default App;
