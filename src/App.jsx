import { Web3ReactProvider } from '@web3-react/core';
import { ethers } from 'ethers';
import React from 'react';
import MainLayout from './components/MainLayout';

// Functie pentru a crea un provider Web3
function getLibrary(provider) {
  return new ethers.providers.Web3Provider(provider);
}

function App() {
  // Verificarea existentei MetaMask
  React.useEffect(() => {
    if (typeof window.ethereum === 'undefined') {
      console.error('MetaMask is not installed!');
      alert('Please install MetaMask to use this application.');
    }
  }, []); // Efectul se executa o singura data la montarea componentei

  return (
    // Furnizeaza contextul Web3 pentru intreaga aplicatie
    <Web3ReactProvider getLibrary={getLibrary}>
      <MainLayout />
    </Web3ReactProvider>
  );
}

export default App;
