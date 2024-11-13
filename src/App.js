import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';
import EventList from './EventList';
import EventManager from './artifacts/contracts/EventManager.sol/EventManager.json';
import TicketNFT from './artifacts/contracts/TicketNFT.sol/TicketNFT.json';

const eventManagerAddress = "YOUR_EVENT_MANAGER_CONTRACT_ADDRESS";
const ticketNFTAddress = "YOUR_TICKET_NFT_CONTRACT_ADDRESS";

function App() {
  const [events, setEvents] = useState([]);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [eventManager, setEventManager] = useState(null);
  const [ticketNFT, setTicketNFT] = useState(null);

  useEffect(() => {
    const initBlockchain = async () => {
      if (window.ethereum) {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const eventManager = new ethers.Contract(eventManagerAddress, EventManager.abi, signer);
        const ticketNFT = new ethers.Contract(ticketNFTAddress, TicketNFT.abi, signer);
        setProvider(provider);
        setSigner(signer);
        setEventManager(eventManager);
        setTicketNFT(ticketNFT);
        await loadEvents(eventManager);
      } else {
        console.error("MetaMask not detected");
      }
    };

    initBlockchain();
  }, []);

  const loadEvents = async (contract) => {
    const eventCounter = await contract.eventCounter();
    const eventsList = [];
    for (let i = 0; i < eventCounter; i++) {
      const event = await contract.events(i);
      eventsList.push({ id: i, ...event });
    }
    setEvents(eventsList);
  };

  return (
    <div className="App">
      <h1>Blockchain Event Ticketing</h1>
      {events.length > 0 ? (
        <EventList events={events} ticketNFT={ticketNFT} signer={signer} />
      ) : (
        <p>Loading events...</p>
      )}
    </div>
  );
}

export default App;
