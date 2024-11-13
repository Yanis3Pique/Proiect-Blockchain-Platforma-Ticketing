import React from 'react';
import Ticket from './Ticket';

const EventList = ({ events, ticketNFT, signer }) => {
  return (
    <div>
      {events.map((event, index) => (
        <Ticket key={index} event={event} ticketNFT={ticketNFT} signer={signer} />
      ))}
    </div>
  );
};

export default EventList;
