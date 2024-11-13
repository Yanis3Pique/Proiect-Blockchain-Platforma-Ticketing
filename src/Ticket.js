import React, { useEffect, useState } from 'react';
import { ethers } from 'ethers';

const Ticket = ({ event, ticketNFT, signer }) => {
  const [dynamicPrice, setDynamicPrice] = useState("0");
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const basePrice = event.ticketPrice;
        const dynamicTicketPrice = await ticketNFT.getDynamicTicketPrice(basePrice);
        setDynamicPrice(ethers.utils.formatEther(dynamicTicketPrice));
      } catch (error) {
        console.error("Error fetching dynamic price:", error);
      }
    };
    
    fetchPrice();
  }, [event, ticketNFT]);

  const handleBuyTicket = async () => {
    try {
      const totalPrice = ethers.utils.parseEther((dynamicPrice * quantity).toString());
      const gasEstimate = await ticketNFT.estimateGas.buyTicket(event.id, quantity, { value: totalPrice });
      
      const transaction = await ticketNFT.buyTicket(event.id, quantity, { value: totalPrice, gasLimit: gasEstimate });
      await transaction.wait();
      alert("Ticket(s) bought successfully!");
    } catch (error) {
      console.error("Transaction failed:", error);
      alert("Transaction failed. Check console for details.");
    }
  };

  return (
    <div>
      <h3>Event: {event.name}</h3>
      <p>Location: {event.location}</p>
      <p>Price per Ticket: {dynamicPrice} ETH (dynamic)</p>
      <p>
        Quantity: 
        <input 
          type="number" 
          value={quantity} 
          onChange={(e) => setQuantity(e.target.value)}
          min="1"
        />
      </p>
      <button onClick={handleBuyTicket}>Buy Ticket</button>
    </div>
  );
};

export default Ticket;
